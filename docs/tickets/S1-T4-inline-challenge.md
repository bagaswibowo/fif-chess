# TICKET S1-T4 — Inline Challenge Dual-Button (G4)

**Sprint:** 1 · **Priority:** P1 · **Role:** Frontend · **Depends:** S1-T1, S1-T2
**Gap:** G4 — inline challenge dual-button [Tolak | Terima] di semua permukaan

## Tugas
1. Komponen `<ChallengeCard>`: dual-button [Tolak | Terima] — styling tema existing (charcoal #312e2b, hijau #81b64c), a11y floor (aria-label, focus-visible) sesuai kebiasaan chess.com.
2. Sumber challenge: event di topik `matcher/<userId>` (challenge = seek langsung ke satu user) — endpoint `api/challenge` (POST/POST-cancel).
3. Pasang di: home + halaman play (mobile: bottom-sheet pattern, board kiri / panel kanan tetap).
4. Terima → match terbentuk via jalur matcher S1-T2; Tolak → publish GameRemoved ke pengirim.
5. Animasi bidak/panel pakai satu CSS var `--move-animation-duration` (180ms) — keputusan arsitektur #3.

## Acceptance
- [ ] Challenge dari user A tampil realtime di home user B dengan dua tombol fungsional.
- [ ] Terima masuk game; Tolak memberi tahu pengirim.
- [ ] Tidak ada modal-blocking; komponen inline.
- [ ] Mobile: card muncul sebagai bottom-sheet, tidak menutup board penuh.
