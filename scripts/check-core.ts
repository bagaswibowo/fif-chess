// Self-check untuk data dan logika yang rusak diam-diam.
// Jalankan: node --experimental-strip-types scripts/check-core.ts
// Satu file, tanpa framework — cukup gagal kalau logikanya rusak.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Chess } from "chess.js";
import { PUZZLES, QUEST_CHAPTERS } from "../lib/puzzle-data.ts";
import { replaySanList } from "../lib/chess.ts";

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_NAME = { p: "pion", n: "knight", b: "gajah", r: "menara", q: "sekertaris" };

// 1. Teka-teki terverifikasi, semua unik, semua bisa dimuat, semua solusi legal.
assert.ok(PUZZLES.length >= 50, `harus minimal 50 teka-teki, ada ${PUZZLES.length}`);

const seen = new Set();
for (const p of PUZZLES) {
  const key = p.fen.split(" ").slice(0, 4).join(" ");
  assert.ok(!seen.has(key), `posisi duplikat: ${key}`);
  seen.add(key);

  const c = new Chess(p.fen);
  assert.equal(c.turn(), p.turn, `${p.id}: turn FEN tidak cocok dengan field turn`);

  const before = c.moves({ verbose: true }).find(
    (m) => m.lan.slice(0, 4) === p.solutionUci.slice(0, 4) && (!p.solutionUci[4] || m.lan[4] === p.solutionUci[4]),
  );
  assert.ok(before, `${p.id}: solusi ${p.solutionUci} bukan langkah legal`);

  // Terapkan, lalu bukti Occupy motif dari keadaan papan yang sebenarnya.
  const victim = c.get(before.to.toLowerCase() as never);
  const mover = before.piece;
  const attacker = before.from.toLowerCase() as never;
  c.move(before.lan);
  const gain = (victim ? VALUE[victim.type as keyof typeof VALUE] : 0) - VALUE[mover as keyof typeof VALUE];

  if (p.motif === "mate") {
    assert.ok(c.isCheckmate(), `${p.id}: klaim skakmat tapi papan bukan skakmat`);
  } else if (p.motif === "capture") {
    assert.ok(before.isCapture(), `${p.id}: klaim tangkap tapi langkah bukan tangkapan`);
  } else if (p.motif === "capture-check") {
    assert.ok(before.isCapture() && c.isCheck(), `${p.id}: klaim tangkap+skak tidak sesuai papan`);
  } else if (p.motif === "promotion") {
    assert.ok(before.isPromotion(), `${p.id}: klaim promosi tapi langkah bukan promosi`);
  } else if (p.motif === "check") {
    assert.ok(c.isCheck(), `${p.id}: klaim skak tapi langkah tidak memberi skak`);
  } else if (p.motif === "tactic") {
    assert.ok(before, `${p.id}: langkah taktis tidak valid`);
  }
  assert.ok(attacker, `${p.id}: petak asal tidak valid`);
}

// 2. Bab Quest adalah subset dari bank, tidak ada materi yang dobrak.
const questIds = new Set(QUEST_CHAPTERS.map((c) => c.id));
assert.ok(questIds.size === QUEST_CHAPTERS.length, "ada id bab Quest duplikat");
for (const c of QUEST_CHAPTERS) {
  const twin = PUZZLES.find((p) => p.id === c.id);
  assert.ok(twin, `bab Quest ${c.id} tidak ada di bank — harusnya satu sumber`);
}

// 3. replaySanList: history PvP harus bisa di-replay persis.
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const r = replaySanList(START, ["e4", "e5", "Nf3", "Nc6"]);
assert.equal(r.length, 4, "replay memotong langkah yang legal");
assert.deepEqual(r.map((m) => m.uci), ["e2e4", "e7e5", "g1f3", "b8c6"]);

// 4. Replay harus berhenti, bukan mengarang, saat history tidak cocok.
assert.equal(replaySanList(START, ["e4", "Qh8"]).length, 1, "replay menerima langkah ilegal");

// 5. Design token: var() tanpa definisi = teks hitam diam-diam di atas
//    kayu gelap. next/font menyediakan variabelnya sendiri, jadi ia dikecualikan.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf-8");
const declared = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
const INJECTED_BY_NEXT_FONT = new Set([
  "--font-geist-sans",
  "--font-geist-mono",
  "--font-instrument-serif",
]);
const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
for (const file of readdirSync(new URL("../components/", import.meta.url))) {
  if (!file.endsWith(".tsx")) continue;
  const src = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf-8");
  for (const m of src.matchAll(/var\((--[a-z0-9-]+)/g)) used.add(m[1]);
}
const missing = [...used].filter((t) => !declared.has(t) && !INJECTED_BY_NEXT_FONT.has(t));
assert.deepEqual(missing, [], `token CSS tanpa definisi: ${missing.join(", ")}`);

// Warna hex literal = design system dilewati.
const REVIEWED = [
  "game.tsx",
  "auth-panel.tsx",
  "pvp-panel.tsx",
  "admin-panel.tsx",
  "community-view.tsx",
  "game-review.tsx",
  "clock-moves-fullscreen.tsx",
  "puzzle-view.tsx",
  "learning-hub.tsx",
];
for (const file of REVIEWED) {
  const src = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf-8");
  const hexes = [...new Set([...src.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]))];
  assert.deepEqual(hexes, [], `${file} masih memakai warna literal: ${hexes.join(", ")}`);
}

console.log(
  `OK — ${PUZZLES.length} teka-teki, ${QUEST_CHAPTERS.length} bab Quest, replay SAN benar, ${used.size} token CSS terdefinisi.`,
);

// Invariant design system: kelas dipakai tapi tidak didefinisikan
const cssText = readFileSync(new URL("../app/globals.css", import.meta.url), "utf-8");
const compDir = fileURLToPath(new URL("../components", import.meta.url));
const custom = new Set();
for (const f of readdirSync(compDir)) {
  if (!f.endsWith(".tsx")) continue;
  const text = readFileSync(join(compDir, f), "utf-8");
  for (const m of text.matchAll(/"([^"]*)"|\{`([^`]*)`\}/g)) {
    for (const cls of (m[1] ?? m[2]).split(/\s+/)) {
      if (/^(ctl|prose|panel|field|data-table|table-wrap|section-title|board-frame)/.test(cls)) custom.add(cls);
    }
  }
}
const undefinedClasses = [...custom].filter((c) => !cssText.includes("." + c)).sort();
assert.deepEqual(undefinedClasses, [], `kelas dipakai tapi tidak ada di globals.css: ${undefinedClasses.join(", ")}`);
console.log(`  ${custom.size} kelas kustom, semua terdefinisi.`);
