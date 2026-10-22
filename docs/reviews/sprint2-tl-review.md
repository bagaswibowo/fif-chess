# TL Final Review — Sprint 2

Tanggal: 2026-10-22 · Reviewer: Tech Lead · Commits: caf1597c, a4287516, 2997cb32, 6cbf1c8e (lokal, belum push)

Verifikasi yang dijalankan reviewer langsung di sxz-server:
- `npm run build` → sukses, semua route baru terdaftar (favorite, pgn, archive, archive/pgn, stats/summary).
- `npx vitest run lib/pgn-parse.test.ts` → 14/14 hijau.
- Grep `INSERT INTO games` (app, lib, scripts, exclude .next) → 4 lokasi; 3 jalur runtime sudah mengisi time_control+game_type.

## Verdict per commit

### caf1597c — S2-T2 backend (arsip + favorite + PGN) — APPROVED

- SQL injection: bersih. Semua query diparameterisasi. `filter` divalidasi whitelist `FILTERS` Set; `page` dinormalisasi angka. Satu-satunya interpolasi string adalah `${PAGE_SIZE}` (konstanta int) dan `OFFSET ${(page-1)*PAGE_SIZE}` (angka hasil `Math.floor` + `Number.isFinite` guard) — bukan input string, aman.
- Tidak ada ORDER BY dinamis dari input user (hardcoded `ended_at DESC NULLS LAST`).
- Scoped authorization: favorite (UPDATE ... WHERE id AND (white|black)=$2 RETURNING), PGN single, PGN bulk, archive — semuanya scoped `(white_user_id=$1 OR black_user_id=$1)`. Bulk PGN memakai `= ANY($1::uuid[])` + scope owner dalam satu query; id milik orang lain di-drop diam-diam (tidak leak).
- Bulk id validation: UUID_RE regex + max 100 ids.
- PGN renderer (`lib/pgn.ts`): Result token benar (white→1-0, black→0-1, draw→1/2-1/2, lainnya `*`), TimeControl & GameType header ada, nilai header di-escape backslash & double-quote. Movelist per ply dengan penomoran pasangan benar; wrapping 80 kolom. Minor non-blocking: escaping tidak menangani newline dalam username; `[Date]` dari ended_at (fallback now) — ok.
- INSERT sites: pvp/challenge/matcher kini mengisi time_control+game_type='live'; default "10+0" & slice(0,10) cocok VARCHAR(10). `scripts/migrate-json-to-pg.ts` sengaja NULL untuk data lama — tercatat di docs/db/sprint2.md, diterima.

### a4287516 — S2-T3 (stats summary + rating snapshot) — APPROVED

- Rating snapshot di match-result: dibungkus try/catch, fallback UPDATE finished biasa — game tidak macet 'active' karena snapshot gagal. Null-safety: `Number(rating) || 1200` fallback; ratingRows.length !== 2 → finish tanpa snapshot (kolom nullable sesuai db doc).
- Race concurrent match-result: guard existing `rows.length === 0 → return` memblokir double-finish sebelum snapshot; snapshot + UPDATE finished + UPDATE users.rating masih 3 query non-transaksional — jendela race sempit dan sudah terguard guard pertama. Diterima untuk skala ini; catatan: bungkus transaksi bila rating engine berkembang.
- Stats summary: window whitelist, interval via `$2::interval` (parameterized) — aman. Win/loss/draw per sisi warna benar. Rating graph null-safe.
- Minor non-blocking: `date: null as unknown as string` (type-cast jelek, berfungsi); `ratingDelta` = earliest→latest dalam window — dokumentasikan semantiknya di UI.

### 2997cb32 — S2-T1 (end-game auto review + coach audio) — APPROVED

- Auto-redirect: timer 2.5s batal saat modal ditutup / `document.hidden`; idempoten via `autoRedirectFired` ref; countdown `aria-live="polite"`; fokus awal di CTA. Sesuai design doc §1.1–1.2.
- A11y catatan non-blocking: design doc menyebut spectator TANPA auto-redirect + CTA "Lihat Analisis" manual — implementasi tidak membedakan spectator. Perlu follow-up kecil atau konfirmasi path modal spectator tidak passing `onReview`. `prefers-reduced-motion` tidak disentuh — hanya `animate-pulse`, dampak minimal.
- Deviasi kecil: design §1.1 jalur 2 ("modal ditutup = trigger review") — backdrop/Esc hanya onClose, tidak memicu review. Lebih aman untuk user; terima dengan catatan.
- Coach audio mute persist: localStorage try/catch, SSR-safe; aria-pressed + aria-label benar.

### 6cbf1c8e — S2-T4 (paste bar + parser) — APPROVED

- XSS: pesan error/status dirender sebagai teks React, bukan dangerouslySetInnerHTML — tidak ada jalur XSS dari PGN header/movetext. Headers hanya untuk SetUp/FEN logic, tidak dirender.
- Parser denial: tidak ada max-length guard; PGN ekstrem besar bisa memblok main thread sesaat (client-side, self-inflicted) — tambah guard ~100k char di follow-up. Non-blocking.
- Copy error sesuai design §3.3; 5 state; Enter submit; aria-busy; error role=alert + fokus pindah — a11y floor terpenuhi.
- Deviasi kecil vs design §3.1: `onOpenGame` di game.tsx hanya `setNavTab("review")`, tidak membuka game by id. Follow-up.
- Testing: 14 kasus hijau (FEN valid/malformed/illegal, PGN lengkap/komentar/NAG/variasi, link internal/eksternal, empty, sampah).

## Fokus review lintas commit

1. SQL injection/parameterization — bersih di semua file baru & yang diubah (ORDER BY hardcoded, tidak dinamis dari input).
2. Scoped authorization — semua endpoint baru scoped pemilik game; tidak ada leak.
3. Rating snapshot race/null-safety — guard existing cukup; fallback 1200 & finish-tanpa-snapshot aman.
4. INSERT sites — 3/3 jalur runtime mengisi kolom baru; migration path NULL terdokumentasi; tidak ada jalur terlewat.
5. PGN renderer & bulk — header benar, escape benar, uuid + max-100 validation ada.
6. Frontend — a11y baik; catatan minor: spectator auto-redirect & parser max-length.
7. Code vs design/db doc — konsisten; dua deviasi minor tercatat.

## Keputusan

Semua 4 commit APPROVED — layak push. Follow-up non-blocking (backlog):
- [ ] Batasi panjang input paste bar (mis. 100k char).
- [ ] Spectator: nonaktifkan auto-redirect atau konfirmasi path modal spectator.
- [ ] onOpenGame internal link: buka game by id, bukan sekadar pindah tab.
- [ ] (Opsional) Bungkus snapshot rating dalam transaksi saat sistem rating berkembang.
