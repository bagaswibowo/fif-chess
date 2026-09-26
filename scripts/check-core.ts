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

// 1. 50 teka-teki, semua unik, semua bisa dimuat, semua solusi legal.
assert.equal(PUZZLES.length, 50, `harus 50 teka-teki, ada ${PUZZLES.length}`);

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
    assert.ok(gain > 0, `${p.id}: tangkan material negatif (${gain})`);
  } else if (p.motif === "capture-check") {
    assert.ok(before.isCapture() && c.isCheck(), `${p.id}: klaim tangkap+skak tidak sesuai papan`);
    assert.ok(gain > 0, `${p.id}: tangkap+skak material negatif (${gain})`);
  } else if (p.motif === "promotion") {
    assert.ok(before.isPromotion(), `${p.id}: klaim promosi tapi langkah bukan promosi`);
  }
  assert.ok(attacker, `${p.id}: petak asal tidak valid`);

  // 2b. Teks harus cocok dengan papan. Angka "bernilai N" hanya boleh
  //     menyebut nilai bidak yang benar-benar hilang, dan "materialmu naik N"
  //     harus sama dengan untung bersih. Teks yang salah pernah lolos karena
  //     hanya dicek motif-nya, bukan angkanya.
  if (p.motif === "capture" || p.motif === "capture-check") {
    const quoted = [...p.description.matchAll(/bernilai (\d+) poin/g)].map((m) => Number(m[1]));
    assert.ok(
      quoted.every((n) => n === (victim ? VALUE[victim.type as keyof typeof VALUE] : 0)),
      `${p.id}: angka di teks (${quoted}) bukan nilai ${victim?.type} yang hilang`,
    );
    const claimed = p.description.match(/\(selisih (\d+) poin\)/);
    assert.ok(!claimed || Number(claimed[1]) === gain, `${p.id}: teks bilang selisih ${claimed?.[1]}, sebenarnya ${gain}`);
    assert.ok(!/materialmu naik/i.test(p.description), `${p.id}: "materialmu naik" tidak berlaku untuk trade satu arah`);
  }
  // 2c. Promosi: pion belum sampai baris promosi sebelum langkah. Teks lama
  //     mengklaim "sudah sampai baris promosi" padahal pion masih di rank 2/7,
  //     dan promotions-capture tidak menyebut bidak yang ditangkap.
  if (p.motif === "promotion") {
    assert.ok(
      !/sudah sampai baris promosi/i.test(p.description),
      `${p.id}: teks mengklaim pion sudah di baris promosi, padahal FEN belum`,
    );
    const c2 = new Chess(p.fen);
    const uci = p.solutionUci;
    const victim = c2.get(uci.slice(2, 4) as never);
    if (victim) {
      assert.ok(
        new RegExp(`menangkap ${PIECE_NAME[victim.type as keyof typeof PIECE_NAME]}`).test(p.description),
        `${p.id}: promosi-tangkap tapi teks tidak menyebut ${victim.type} yang diambil`,
      );
    }
  }
}

// 2. Bab Quest adalah subset dari bank, tidak ada materi yangdobrak.
const questIds = new Set(QUEST_CHAPTERS.map((c) => c.id));
assert.ok(questIds.size === QUEST_CHAPTERS.length, "ada id bab Quest duplikat");
for (const c of QUEST_CHAPTERS) {
  const twin = PUZZLES.find((p) => p.id === c.id);
  assert.ok(twin, `bab Quest ${c.id} tidak ada di bank —Fqigl harusnya satu sumber`);
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
// Komponen juga boleh memakai var(); kalau token hilang di situ, komponennya
// hanya diam-diam jatuh ke warna default.
for (const file of readdirSync(new URL("../components/", import.meta.url))) {
  if (!file.endsWith(".tsx")) continue;
  const src = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf-8");
  for (const m of src.matchAll(/var\((--[a-z0-9-]+)/g)) used.add(m[1]);
}
const missing = [...used].filter((t) => !declared.has(t) && !INJECTED_BY_NEXT_FONT.has(t));
assert.deepEqual(missing, [], `token CSS tanpa definisi: ${missing.join(", ")}`);

// Warna hex literal = design system dilewati. Hanya berlaku untuk komponen
// yang ditulis ulang dalam revisi ini; file lama (icons3d, scan-view, dll.)
// sengaja belum disentuh. Perluas daftar ini
// ketika file legacy ikut dirapikan.
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

// 4. Invariant design system yang pernah bocor: kelas dipakai tapi tidak
//    didefinisikan = tombol tanpa fill. Cek semua className komponen.
const cssText = readFileSync(new URL("../app/globals.css", import.meta.url), "utf-8");
const compDir = fileURLToPath(new URL("../components", import.meta.url));
const custom = new Set<string>();
for (const f of readdirSync(compDir)) {
  if (!f.endsWith(".tsx")) continue;
  const text = readFileSync(join(compDir, f), "utf-8");
  // Form "", {} dan `{}` — semuanya bisa memuat className.
  for (const m of text.matchAll(/"([^"]*)"|\{`([^`]*)`\}/g)) {
    for (const cls of (m[1] ?? m[2]).split(/\s+/)) {
      if (/^(ctl|prose|panel|field|data-table|table-wrap|section-title|board-frame)/.test(cls)) custom.add(cls);
    }
  }
}
const undefinedClasses = [...custom].filter((c) => !cssText.includes("." + c)).sort();
assert.deepEqual(undefinedClasses, [], `kelas dipakai tapi tidak ada di globals.css: ${undefinedClasses.join(", ")}`);
console.log(`  ${custom.size} kelas kustom, semua terdefinisi.`);
