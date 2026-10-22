# TICKET S4-T4 — Endgame Drills: kuras posisi akhir per tema

**Sprint:** 4 · **Priority:** P2 · **Role:** Fullstack · **Depends:** S3-T1 (puzzle core, attempt recording)

## Context
Referensi menu-feature-map §4 (`/endgames`: drill per tema — Bidak, Perwira/Benteng, Menteri, Ketimpangan + progress %). S3-T4 sudah punya infrastruktur tema + progress; drill endgame = **kurasi** subset puzzle bertema `endgame` (kolom `themes` sudah array) per kelompok, bukan tabel/konten baru. Pilihan ini lebih murah dari Solo Chess engine baru dan memakai loop yang sudah live.

## Tugas
1. **Kurasi**: query dump/db untuk puzzle tema `endgame` + tema turunan (mateIn2+, rookEndgame bila ada), kelompokkan ke 5-6 set drill (mis. "Skatmat dasar", "Benteng vs Bidak", "Menteri + Raja mati") — simpan pemetaan set→puzzle ids sebagai konstanta `lib/endgame-drills.ts` (id list statis hasil kurasi, bukan generated).
2. **UI** `components/views/endgame-drills-view.tsx`: daftar set dengan progress % per set (dari puzzle_attempts existing, pola S3-T4 mastery), klik set → solve mode puzzle core (S3-T1) dengan filter puzzle dari set. Progress bar pakai teks % untuk screen reader.
3. Sidebar (S4-T1): item "Permainan Akhir" di grup Berlatih.
4. Reuse solve-mode + hint + streak dari S3-T1 tanpa duplikasi komponen.

## Acceptance
- [ ] 5-6 set drill tampil dengan % progress yang benar (verifikasi 1 user dengan attempts campuran).
- [ ] Klik set membuka puzzle dari set itu saja; solve menghitung attempt ke progress.
- [ ] Semua puzzle dalam set benar-benar bertema endgame (verifikasi via psql).

## Guardrail
- YAGNI: tanpa engine tabel endgame (tablebase), tanpa generator posisi — kurasi puzzle Lichess existing saja.
- No konten baru di DB: mapping statis di lib, bukan tabel drills.
