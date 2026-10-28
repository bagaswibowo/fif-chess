# S9/S10 — Scope Decision (Orchestrator, dari chesscom-parity-audit §2-3)

## S9 — Core Play & Trust UX (4 ticket)
| Ticket | Scope | Source gap |
|---|---|---|
| S9-T1 | Auth messaging benar di SEMUA view: pending → 403 `account_pending` + pesan "Akun menunggu persetujuan admin" + badge status di user chip (approved/pending); error 5xx/DB → state generik + "Coba lagi" (bukan CTA login palsu). Cakupan: endgame-drills, friends, leaderboard, courses, pvp, archive, practice, home. Backend: pastikan SEMUA endpoint authed memetakan pending→403 (audit endpoint per endpoint, pola `resolvePgUser` S7/FIX-1.2). | G0.1–G0.3 |
| S9-T2 | Guest gating: buka tanpa login = bots, scan, coach, spectator, learning-hub, review (paste PGN). Nav rejection dihapus untuk view itu; notice guest jadi `role="alert"` persisten inline (bukan 2,8s) sampai didismiss; CTA "Daftar untuk simpan progres" hanya di momen relevan (setelah puzzle/game selesai), tidak memblokir masuk. | G1.1–G1.2 |
| S9-T3 | Standardisasi state components: 1 `ErrorState` (pesan generik + "Coba lagi" + kode error sr-only), 1 `EmptyState` (ilustrasi original + 1 CTA), 1 `LoadingState` (skeleton). Ganti pola error/loading/empty per-view di SEMUA view (grep `error ?` / `loading ?` di components/). Tanpa hapus fitur. | G6.2–G6.4 |
| S9-T4 | A11y sweep: `prefers-reduced-motion` di semua animasi (confetti, animate-in, pulse, flybrain); keyboard penuh bottom-nav + "Lainnya" sheet (focus trap, Esc, arah panah); heading semantik `<h2 class="sr-only">` tiap grup sidebar; `aria-current` konsisten di item "Lainnya" sheet (gate mounted/isDesktop, pola BUG-3). | G7.1–G7.3 |

Out-of-scope S9: data baru (streak/puzzle-filter = S10), fitur Watch = S10.

## S10 — Stats, Watch & Community (4 ticket)
| Ticket | Scope | Source gap |
|---|---|---|
| S10-T1 | Puzzle filter + stats: filter tema + rentang rating di puzzle unlimited (endpoint `/api/puzzles` perlu support query); panel personal (rating taktik, streak, accuracy, solved/hari ini) — SEMUA agregasi SQL riil dari `puzzle_attempts` (NO mock, NO hardcode angka). | G3.1–G3.2 |
| S10-T2 | Review deep-dive: persentase akurasi per pemain + daftar langkah kritis yang bisa diklik untuk lompat (riil dari engine graph yang sudah ada di lib/engines). | G4.1 |
| S10-T3 | Leaderboard + Friends: filter rentang rating (SQL-side), empty-state "cara naik papan = main rated"; tombol quick-challenge dari baris teman memakai clock preset S6. | G5.1–G5.2 |
| S10-T4 | Watch hub + onboarding: upgrade spectator/broadcast jadi hub 3 sumber (Live events / JevTV / Streamers) dari data broadcast RIIL; onboarding 3 langkah untuk user baru-approved (main pertama → puzzle pertama → share) — tanpa memblokir. | §4/§5 audit (pola /watch) + G6.1 |

## Urutan eksekusi
S9 wave: (PM ticket) → Designer flow → Architect kontrak → dev (backend ∥ frontend) → TL → QA 1360×768 → deploy.
S10 langsung setelah S9 live (pipeline sama).
