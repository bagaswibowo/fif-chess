/**
 * lib/pgn.ts (ticket S2-T2, G11)
 * Renderer PGN minimal dari header + SAN movelist — dipakai oleh
 * app/api/games/[id]/pgn dan app/api/games/archive/pgn (bulk).
 * Output mengikuti PGN spec (export format) agar terbaca di
 * lichess/chess.com import.
 */

export type PgnHeaderInput = {
  white: string;
  black: string;
  result: string;
  timeControl: string | null;
  gameType: string | null;
  endedAt: string | null;
};

/** Result DB ('white'|'black'|'draw'|...) → PGN result token. */
function pgnResult(result: string): string {
  if (result === "white") return "1-0";
  if (result === "black") return "0-1";
  if (result === "draw") return "1/2-1/2";
  return "*";
}

/**
 * Render movelist: "1. e4 e5 2. Nf3 ..." — 1-based move pairs. SAN list di
 * game_moves disimpan per ply (move_number naik tiap langkah, putih & hitam).
 */
function movelist(sans: string[], result: string): string {
  const parts: string[] = [];
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
    parts.push(sans[i]);
  }
  parts.push(result);
  if (parts.length === 1) return result; // tanpa langkah → hanya hasil
  // Bungkus ~80 kolom seperti konvensi export PGN.
  const lines: string[] = [];
  let line = "";
  for (const p of parts) {
    if (line.length + p.length + 1 > 80) {
      lines.push(line);
      line = p;
    } else {
      line = line ? `${line} ${p}` : p;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

export function buildPgn(header: PgnHeaderInput, sans: string[]): string {
  const date = header.endedAt ? new Date(header.endedAt) : new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const result = pgnResult(header.result);
  const escape = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const lines = [
    `[Event "jev-chess ${header.gameType ?? "game"}"]`,
    `[Site "jev-chess"]`,
    `[Date "${yyyy}.${mm}.${dd}"]`,
    `[White "${escape(header.white)}"]`,
    `[Black "${escape(header.black)}"]`,
    `[Result "${result}"]`,
    `[TimeControl "${header.timeControl ?? "-"}"]`,
    `[GameType "${header.gameType ?? "-"}"]`,
  ];
  return `${lines.join("\n")}\n\n${movelist(sans, result)}\n`;
}
