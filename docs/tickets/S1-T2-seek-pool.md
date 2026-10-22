# TICKET S1-T2 — Seek Pool / Matching (G2)

**Sprint:** 1 · **Priority:** P0 · **Role:** Backend/fullstack · **Depends:** S1-T1
**Gap:** G2 — matching/seek pool live (matcher tickets, GameAdded/Removed events)

## Tujuan
Pemain bisa seek game rated/casual, match terbentuk realtime, kedua pemain masuk game.

## Tugas
1. `api/seek` (POST): buat/cancel seek ticket (rating, time control, casual|rated). Simpan in-memory/Redis (ZSET by rating) — cukup, satu instance.
2. Matcher loop (dipicu saat publish seek, bukan cron): cari ticket lawan dalam window rating (±200 → melebar), publish `GameAdded` ke topik `matcher/<userId>` kedua pemain via RealtimeBus.
3. Pembuatan game pakai model `Game` existing + clock (`use-chess-clock.ts` TC) — tidak ada tabel baru kecuali perlu `Seek` (pilih: Redis-only, no Prisma model — YAGNI).
4. Idempotensi: seek yang sudah match tidak bisa match lagi (atomic pop dari ZSET).

## Acceptance
- [ ] Dua klien seek TC sama → keduanya menerima `GameAdded` < 2s, diarahkan ke game yang sama.
- [ ] Cancel seek menghapus ticket + publish `GameRemoved`.
- [ ] Tidak ada polling baru; semua konsumen via WS.

## Anti-slop
Tidak ada mock matchmaking, tidak ada bot-seed palsu di pool.
