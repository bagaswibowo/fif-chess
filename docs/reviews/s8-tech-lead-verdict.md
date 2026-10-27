# S8 — Tech Lead Verdict: APPROVED (commit `36657fc`)

## Scope review (7 commit S8: `ce78681`…`36657fc`)
| Verifikasi | Hasil |
|---|---|
| `npx tsc --noEmit` | exit 0 (verifikasi TL, tree `36657fc`) |
| `npx next build` | exit 0 (`Compiled successfully`, 50/50 static) |
| Runtime smoke `lib/realtime/tournament-sweeper.ts` | `RUNTIME_GRAPH_OK` |
| CI GitHub `#40571912598` (SHA `36657fc`) | **success** (build + smoke + Docker + GHCR) |
| Re-QA lokal 1360×768, build produksi, guest (jalur deterministik P0) | **20/20 hash: 0 crash, shell utuh, `aria-current="page"` = 1 di semua** |
| P0 F1 (`#/drills` React #300) | FIX terkonfirmasi: `useMemo themeChips` (baris 231) di atas early-return (248/283); `#/drills` guest render shell + konten, crash boundary = 0 |
| P1 F2 (`#/puzzles` aria-current = 2) | FIX terkonfirmasi: strip subtab = `role=tablist/tab + aria-selected`, tanpa `aria-current`; section sidebar satu-satunya pembawa `page` (sweep produksi agent shell: 24 hash, `cur=1`) |
| P2 F3 admin blank | FIX: render-branch admin di-guard — non-admin dapat empty-state "Khusus admin" + redirect `#/admin` → `#/home` (verified agent shell) |
| P2 F4 input community unlabeled | FIX: aria-label/`htmlFor` Indonesia pada 4 input + textarea modal (commit `36657fc`) |
| P2 F5 archive 401 utk pending | FIX: `resolvePgUser` (pola S7) — pending → 403 `account_pending`, guest tetap 401 (commit `7020e61`) |
| P2 F7 dashboard fetch per-menu | VERIFIED ter-fix struktural: fetch hanya saat `navTab==='home'` (gate mount, bukan shell-level) |
| P2 F8 coach scroll internal 96px | FIX: papan cap ≤540px width-driven, no-scroll di 1360×768 (commit `db22a65`) |
| Regresi hash lama | 21/21 resolve via `SECTION_OF_TAB` (verifikasi shell agent: `missing=[], extra=[]`) |

## Housekeeping (TIDAK dalam scope commit — tindakan ops)
- Akun QA `s8qa_audit` (`u-45a15372`) masih di users store produksi → **hapus setelah deploy** (lihat `docs/qa/s8-menu-audit.md` §housekeeping).
- `graphify-out/` (untracked, tak pernah commit) + perubahan kosmetik `AGENTS.md` di working tree sudah di-revert.

## Keputusan
**APPROVED untuk deploy** — CI green, build+smoke clean, seluruh P0/P1/P2 audit terverifikasi fix di build produksi. Push `fif-chess` sudah dilakukan (`06ee81e..36657fc`). Langkah berikutnya (DevOps): recreate container di sxz-server, verifikasi health 200, hapus `s8qa_audit`.
