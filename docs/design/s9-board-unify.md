# S9-B — Board Unification (papan seragam = standar menu Main)

Pemicu: laporan user 2026-10-28 — "size papan harusnya sama semua kayak di menu Main".

## Akar masalah (diukur riil + kode, 1360×768)
Tiap view punya cap `max-w`/`max-h` berbedad → papan tak seragam:
| View | cap kini | @768dvh |
|---|---|---|
| Main (game) | `calc(100dvh-190px)` | 578 (render ~472 2-kolom) |
| Puzzles/Rush/Daily | `calc(100dvh-260px)` | 508 |
| Coach/Spectator | `calc(100dvh-260px)` | 508 |
| Scan | `calc(100dvh-230px)` | 538 |
| Openings/Classroom/Lessons | `calc(100dvh-260px)` / `400px` | 400–508 |
| Explorer | `480px` | 480 |
| Live-arena/Clock-fullscreen | `calc(100dvh-180/190px)` | 578–588 |
| Game-review | `760px` | 760 |

## Target (UNIFIED)
Satu token `--board-cap` di `:root` (globals.css) = `calc(100dvh - 190px)` (selaras Main,
papan terbesar & board-first). SEMUA view ber-papan (pola A) pakai:
```
max-w-[min(100%,var(--board-cap))]
```
→ papan seragam 578px @768 di semua menu (Main = acuan). View 2-kolom (board+panel)
tetap width-driven oleh kolomnya, tapi cap-nya SAMA, jadi tak lagi menciut kecil-kecilan.
Papan khusus fullscreen (clock-moves-fullscreen, game-review 760) = OPT-OUT eksplisit
(tetap boleh beda — memang konteks berbeda), dicatat di file terkait.

## Guardrail
- No-scroll 1360×768 tetap (periksa ulang tiap view yang papan-nya naik).
- `prefers-reduced-motion`, a11y floor, copy Indonesia dipertahankan.
- Jangan ubah logika engine/interaksi — HANYA kelas cap sizing + layout Pola A board-first.

## Urutan
Tunggu T1+T3 commit (mereka retrofit view yang sama) → dispatch 1 agent board-unify
(menyentuh semua view ber-papan + globals.css token) → build → TL → QA (ukur tiap menu
1360×768, board seragam, 0 scroll) → push+CI+deploy.
