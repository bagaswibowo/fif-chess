/**
 * scripts/import-lichess-puzzles.ts (S3-T1)
 * Streaming import Lichess puzzle dump -> puzzles (jev-postgres).
 * Streaming: curl | zstdcat piped ke readline; filter saat stream (RD<=100,
 * rating 800-2200, popularity>=90), cap 50.000. Idempoten: ON CONFLICT
 * (external_id) WHERE external_id IS NOT NULL DO NOTHING.
 * Pakai: node --experimental-strip-types scripts/import-lichess-puzzles.ts
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import pg from "pg";

const CAP = Number(process.argv[2] ?? 50000);
const SOURCE = process.argv[3] ?? "https://database.lichess.org/lichess_db_puzzle.csv.zst";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://jev:jev_chess_dev@127.0.0.1:5432/jev_chess";
const BATCH = 500;
const PROGRESS_EVERY = 5000;

type Row = { title: string; fen: string; moves: string; rating: number; themes: string[]; external_id: string };

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const existing = new Set<string>();
  const ex = await client.query("SELECT external_id FROM puzzles WHERE external_id IS NOT NULL");
  for (const r of ex.rows as { external_id: string }[]) existing.add(r.external_id);
  console.log(`existing external_ids: ${existing.size}`);

  const curl = spawn("curl", ["-sSL", "--fail", SOURCE], { stdio: ["ignore", "pipe", "inherit"] });
  const zstd = spawn("zstdcat", [], { stdio: [curl.stdout, "pipe", "inherit"] });

  const rl = createInterface({ input: zstd.stdout, crlfDelay: Infinity });

  let inserted = 0, scanned = 0, skippedDup = 0, progressMark = 0;
  let batch: Row[] = [];

  async function flush() {
    if (batch.length === 0) return;
    const vals: unknown[] = [];
    const tuples = batch.map((r, i) => {
      const b = i * 6;
      vals.push(r.title, r.fen, JSON.stringify(r.moves.split(" ")), r.rating, r.themes, r.external_id);
      return `($${b + 1},$${b + 2},$${b + 3}::jsonb,$${b + 4},$${b + 5}::text[],$${b + 6})`;
    });
    await client.query(
      `INSERT INTO puzzles (title, fen, solution_moves, rating, themes, external_id)
       VALUES ${tuples.join(",")}
       ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO NOTHING`,
      vals,
    );
    inserted += batch.length;
    batch = [];
  }

  let headerSeen = false;
  for await (const line of rl) {
    if (!line) continue;
    if (!headerSeen) { headerSeen = true; continue; }
    scanned++;
    const c = parseCsvLine(line);
    if (c.length < 9) continue;
    const [pid, fen, moves, ratingS, rdS, popS, , themesS] = c;
    const rating = Number(ratingS);
    const rd = Number(rdS);
    const pop = Number(popS);
    if (!Number.isFinite(rating) || rating < 800 || rating > 2200) continue;
    if (!Number.isFinite(rd) || rd > 100) continue;
    if (!Number.isFinite(pop) || pop < 90) continue;
    if (existing.has(pid)) { skippedDup++; continue; }
    const themes = themesS ? themesS.split(" ").map((t) => t.trim()).filter(Boolean) : [];
    batch.push({ title: `Lichess ${rating} ${pid}`.slice(0, 100), fen, moves, rating, themes, external_id: pid });
    if (batch.length >= BATCH) {
      await flush();
      if (inserted >= progressMark + PROGRESS_EVERY) {
        progressMark = inserted;
        console.log(`progress: scanned=${scanned} inserted=${inserted}`);
      }
      if (inserted >= CAP) break;
    }
  }
  await flush();
  console.log(`done: scanned=${scanned} inserted=${inserted} skippedDup=${skippedDup}`);
  await client.end();
  curl.kill(); zstd.kill();
}

main().catch((e) => { console.error(e); process.exit(1); });
