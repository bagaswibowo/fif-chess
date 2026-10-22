# TICKET S2-T4 — Analysis Fast-path: Paste PGN/FEN (G7)

**Sprint:** 2 · **Priority:** P2 · **Role:** Frontend (+1 parser util) · **Depends:** S2-T1 (halaman analysis), bisa paralel
**Gap:** G7 — fast path paste PGN/FEN langsung masuk board analisis.

## Context
- Pola chess.com terverifikasi (analisis §7): SATU input universal di atas halaman analysis — "Paste a PGN, FEN, or link…" → paste → langsung board. Power users tidak pernah lebih dari 2 klik.
- Analysis board existing: `app/api/analysis/route.ts` + board components — fast-path harus memakai jalur analisis yang sama, bukan jalur baru.

## Tugas
1. `lib/pgn-fen-parser.ts`: input string → deteksi FEN (regex struktur 6 field) atau PGN (header tags + movetext) → {fen, moves[]}. Unit test kecil (fen valid/invalid, pgn dengan/without headers, movetext dengan komentar & NAGs di-skip). Fallback `chess.js` load bila tersedia.
2. Komponen paste bar di halaman `/analysis` (di atas kartu entri): textarea 1 baris + tombol "Analisis". Enter juga submit.
3. Paste FEN → langsung board dengan posisi tersebut. Paste PGN → board mulai dari posisi awal + move list terisi. Parsing gagal → pesan inline error yang jelas (aria-live=polite), jangan silent.
4. Optional bila trivial: paste URL game internal `/analysis/[gameId]` → redirect. Eksternal link = out of scope (YAGNI).

## Acceptance
- [ ] Paste FEN valid → board menampilkan posisi, eval berjalan via pipeline existing.
- [ ] Paste PGN valid → movelist terisi dan bisa dinavigasi; analisis jalan.
- [ ] Paste sampah → pesan error inline yang accessible, tidak crash.
- [ ] Unit test parser hijau (`npm test` / test runner repo).

## Guardrail
- Reuse jalur analisis existing 100% — fast-path hanya pintu masuk.
- Tanpa dependency baru (pakai chess.js bila sudah ada; cek package.json dulu).
- Minimal diff: satu lib + satu komponen + wiring di halaman analysis.

## DB
- Tidak ada perubahan schema.
