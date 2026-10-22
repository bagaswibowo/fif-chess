# CATATAN S3-T5 — Puzzle Battle 1v1: DEFERRED

**Sprint:** 3 · **Status:** DEFERRED ke Sprint 4+ (keputusan PM)

## Alasan
- `/puzzles/battle` (menu map §Teka-Teki) butuh: matchmaking by username, sinkronisasi board realtime 1v1, rating duel, tabs [Bermain|Tonton|Papan Peringkat] — effort setara 1-2 sprint penuh sendiri, bukan "effort kecil".
- Realtime infra (S1-T1 ws-gateway) sudah ada sehingga murah secara infrastruktur, tapi interaksi puzzle real-time (validasi ganda, anti-cheat timing) belum dirancang.
- Sprint 3 difokuskan ke 4 fitur solo (core/daily/rush/mastery) yang menghabiskan seluruh kapasitas.

## Prasyarat bila diambil nanti
- S3-T1 (core), S1-T1 (realtime) live dan stabil.
- Desain kecil dulu: protokol pesan WS baru (battle:match, battle:move, battle:win) — tidak boleh menyentuh protokol game existing.
