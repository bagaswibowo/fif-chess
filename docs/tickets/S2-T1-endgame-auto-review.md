# TICKET S2-T1 — End-game → Auto Game Review (G5)

**Sprint:** 2 · **Priority:** P1 · **Role:** Frontend (+ wiring match-result) · **Depends:** S1 selesai
**Gap:** G5 — modal hasil tidak mentok "mati"; setiap game selesai langsung membuka review dengan komentar coach.

## Context
- `lib/post-game-analysis.ts` + `lib/commentary.ts` + `components/game-review.tsx` SUDAH ADA — ini murni wiring, bukan fitur baru.
- `app/api/match-result/route.ts` saat ini membersihkan presence (S1-T3-fix) tapi tidak mengantarkan user ke halaman review.
- Modal hasil: `components/game-over-modal.tsx`.

## Tugas
1. `game-over-modal.tsx`: tambah CTA utama **"Review Permainan"** (styling tema existing, a11y floor: aria-label, focus-visible, tombol pertama menerima fokus). Sekunder: "Kembali ke Lobby".
2. Saat game `status` berubah ke finished via event realtime (topik game/presence existing), auto-redirect pemain (bukan spectator) ke `/analysis/[gameId]?tab=review` setelah 2.5s ATAU saat modal ditutup — mana yang lebih dulu.
3. Route `/analysis/[gameId]` tab review: muat `post-game-analysis.ts` hasil (cek `analysis_results` table — FK game_id sudah ada) + render `game-review.tsx`; audio commentary dari `commentary.ts` dengan tombol mute (persist preferensi di localStorage).
4. Idempoten: kalau review sudah ada di `analysis_results`, jangan jalankan analisis ulang (query dulu, INSERT kalau kosong).

## Acceptance
- [ ] Game selesai → kedua pemain otomatis diarahkan ke review; spectator tidak.
- [ ] Review menampilkan hasil analisis tersimpan + commentary audio bisa play/mute.
- [ ] Refresh halaman review tidak menjalankan analisis kedua kali (1 row per game_id).
- [ ] a11y: modal bisa dinavigasi keyboard penuh.

## Guardrail
- JANGAN menulis ulang post-game-analysis.ts / commentary.ts — hanya panggil.
- Tanpa mock: analisis nyata via pipeline existing; kalau engine gagal, tampilkan error state, jangan JSON palsu.
- Minimal diff: tidak refactor modal existing lebih dari yang dibutuhkan.

## DB
- Tidak ada perubahan schema. `analysis_results.game_id` FK sudah ada; pastikan UNIQUE(game_id) bila belum (cek dulu, laporkan ke DB Engineer).
