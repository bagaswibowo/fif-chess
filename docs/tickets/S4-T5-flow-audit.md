# TICKET S4-T5 — View/Flow Audit: end-game → review → archive → analysis loop

**Sprint:** 4 · **Priority:** P2 · **Role:** Frontend/QA · **Depends:** S4-T1, S4-T2 (butuh shell+home untuk audit menyeluruh)

## Context
Referensi analysis §13 (peta flow): landing → home → task cards → puzzles/lessons/review; game row → game ATAU review; end-game → auto review → archive → analysis. Sprint 1-3 membangun fitur secara per-ticket; hubungan antar-view perlu diaudit supaya loop lengkap dan tak ada dead end.

## Tugas
1. **Audit tab-by-tab** semua view existing (play, bots, coach, puzzle-hub, daily, rush, theme-mastery, vision/learning, scan, review, community, spectator, admin) di shell baru: setiap view harus punya (a) jalur masuk dari sidebar/home, (b) jalur keluar yang bermakna (bukan dead end).
2. **End-game flow**: selesaikan 1 game nyata → modal akhir game harus menawarkan "Review Partai" (game-review S2-T1) → dari review link "Arsip & Analisis" (S2-T2/S2-T4). Verifikasi auto-redirect/review path berfungsi dari modal akhir.
3. **Challenge flow**: challenge masuk → terima (inline dual-button) → game aktif → muncul di home "Bermain Online" & badge nav.
4. **Dokumentasi**: tulis `docs/design/sprint4-flow-audit.md` — tabel view → entry → exit → status (OK/fix), plus daftar fix kecil yang diterapkan (link/back-button yang hilang, empty state, aria).
5. Terapkan fix minimal yang ditemukan (tambah link/tombol back), tanpa refactor besar.

## Acceptance
- [ ] Semua view punya entry & exit; tidak ada view yang hanya bisa diakses via URL langsung.
- [ ] Loop end-game→review→archive→analysis bisa dijalankan end-to-end tanpa dead end (bukti: langkah tercatat di audit doc).
- [ ] Audit doc lengkap dengan status per view; semua fix tercatat.
- [ ] Keyboard-only walk melalui loop utama berhasil (a11y floor).

## Guardrail
- Audit = verifikasi + fix kecil, BUKAN redesign view (redesign masuk ticket sendiri bila besar).
- Tidak menambah fitur baru di ticket ini — hanya menghubungkan yang ada.
