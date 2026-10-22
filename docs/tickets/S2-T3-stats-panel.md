# TICKET S2-T3 — Stats Panel: Rating History (G15)

**Sprint:** 2 · **Priority:** P2 · **Role:** Fullstack · **Depends:** S2-T2 (DB kolom rating snapshot di games)
**Gap:** G15 — rating history chart per kategori waktu + filter window.

## Context
- Pola chess.com terverifikasi (analisis §10): leaderboard rating per kategori (cepat/kilat) dengan counter "+33 games".
- games existing tidak punya rating; S2-T2 menambahkan snapshot rating before/after di games. Itu artinya **kita bisa derive rating history dari games** — tidak perlu tabel `rating_history`.

## Tugas
1. API `app/api/stats/rating-history/route.ts` (GET): param `category` (time_control bucket) + `window` (7d|30d|90d|all); query games user (white/black, status finished, rated), ambil rating after per game berurutan waktu → array {date, rating}.
2. Frontend panel/section Stats: line chart rating history per kategori waktu (pakai library chart yang SUDAH dipakai repo; kalau belum ada, render SVG sederhana — JANGAN tambah dependency berat). Filter window [7 hari|30 hari|90 hari|Semua], a11y: chart punya tabel data visually-hidden atau summary text (selisih rating + jumlah game) untuk screen reader.
3. Header stats: rating saat ini per kategori + delta pada window terpilih.

## Acceptance
- [ ] Chart menampilkan rating history benar untuk tiap kategori dengan data nyata.
- [ ] Filter window mengubah data (verifikasi: 7d ≠ all untuk user dengan game lama).
- [ ] Screen reader mendapat ringkasan angka, bukan chart kosong.
- [ ] Tidak ada tabel `rating_history` dibuat (keputusan YAGNI tercatat).

## Guardrail
- YAGNI: derive dari games. Tabel rating_history hanya bila implementasi membuktikan derive tidak cukup (dokumentasikan bila demikian).
- Tanpa mock data; window filter di SQL (WHERE ended_at > now() - interval), bukan di client.
- Minimal diff: satu API route + satu komponen.

## DB
- Tidak ada tabel baru. Mengandalkan kolom snapshot rating dari S2-T2 — konfirmasi DB Engineer menyetujui desain snapshot.
