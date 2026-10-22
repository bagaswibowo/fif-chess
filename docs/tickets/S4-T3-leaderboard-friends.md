# TICKET S4-T3 — Sosial: Leaderboard Global + Friends (list + challenge inline)

**Sprint:** 4 · **Priority:** P1 · **Role:** Fullstack · **Depends:** S2-T3 (stats), S1-T4 (inline challenge)

## Context
Cek existing: leaderboard sudah ada di rush-view (`/api/puzzles/rush/leaderboard`, per-rush saja) — belum ada leaderboard global berdasarkan stats. Community view ada tapi tanpa friends list. Referensi menu-feature-map §6 (Teman: per-teman [Tantangan→...] inline; Papan Peringkat: global per tipe partai).

## Tugas
1. **API** `app/api/leaderboard/route.ts` (GET): top 50 dari tabel stats existing (rating game user — ambil sumber rating dari stats panel S2-T3), SQL-side ORDER BY + LIMIT, filter `?type=` bila stats punya tipe. Tampilkan juga posisi user sendiri.
2. **UI** `components/views/leaderboard-view.tsx`: tabel peringkat (peringkat, username, rating, game count), highlight row user sendiri, link username → profil/stats (deep-link publik, signature UX #6 — pakai halaman stats yang ada).
3. **Friends**: API `app/api/friends/route.ts` (GET list, POST add/remove via username) — tabel `friends` baru minimal (user_id, friend_id, created_at). UI: section di community-view (atau view baru friends-view) — list teman dengan status online (dari presence S1-T3) + tombol **Tantangan** inline per teman yang memicu challenge flow S1-T4 (dual-button signature UX #2).
4. Sidebar (S4-T1): item "Papan Peringkat" di Komunitas kini hidup; friends masuk grup Komunitas.

## Acceptance
- [ ] Leaderboard top 50 terurut benar dari data stats riil; user sendiri ter-highlight.
- [ ] Tambah/hapus teman berfungsi; teman online menandakan status presence benar.
- [ ] Tombol Tantangan per teman mengirim challenge yang diterima lawan (verifikasi 2 akun).
- [ ] Semua query SQL-side (LIMIT/ORDER), bukan JS sort atas seluruh tabel.

## Guardrail
- YAGNI: tanpa pesan/direct chat, tanpa invite link/email, tanpa klub.
- No-mock: leaderboard kosong → empty state jujur, bukan nama dummy.
