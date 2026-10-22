# TICKET S1-T3 — Presence + Badge Nav Realtime (G3)

**Sprint:** 1 · **Priority:** P1 · **Role:** Fullstack · **Depends:** S1-T1
**Gap:** G3 — presence + realtime badge nav ("Bermain N")

## Tugas
1. Presence: koneksi WS aktif = online (heartbeat disconnect = offline). Publish ke `presence/<userId>`; simpan set online di Redis.
2. Badge nav: hitung user yang sedang dalam game (state dari Game model, updated saat GameAdded/hasil) → komponen nav badge subscribe topik, update realtime.
3. Ganti polling badge existing (jika ada) dengan konsumen WS — polling lama dihapus, tidak dibiarkan dobel.

## Acceptance
- [ ] Buka dua browser: login/logout di satu terlihat di badge browser lain < 2s.
- [ ] Mulai/selesai game mengubah angka "Bermain N" realtime.
- [ ] Tidak ada endpoint polling yang tersisa untuk badge.
