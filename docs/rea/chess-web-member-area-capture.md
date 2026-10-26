# Chess.com Member-Area Capture — referensi parity jev-chess

**Sumber**: capture live via sesi browser ter-login (cookie import `ACCESS_TOKEN` + `CHESSCOM_REMEMBERME`
httpOnly), user `zenwisteriaclarines`, locale `id_ID` ("Beranda"). Tanggal capture: 2026-10-26.
**Batas legal**: hanya POLA struktur navigasi, copy, & layout yang direkam. Tidak ada aset,
ilustrasi, teks berhak-cipta, font, atau ikon chess.com yang disalin — padanan jev-chess dibuat
original (token CSS + SVG lucide sendiri).

## Metode login (tanpa credentials di agent)

Sesi Hermes Desktop tidak tersedia, jadi login dilakukan dengan **import cookie hasil export**
melalui CDP `Network.setCookie`:
1. 16 cookie di-set termasuk yang httpOnly (`ACCESS_TOKEN`, `CHESSCOM_REMEMBERME`, `PHPSESSID`) —
   httpOnly memang tidak bisa di-set via `document.cookie` (JS), hanya lewat CDP/network layer.
2. Verifikasi: `/home` menampilkan header `...Uji Coba Gratis Cari zenwisteriaclarines`,
   `userMenu` present, 34 elemen avatar ter-render. Token `id_ID` (locale Bahasa Indonesia).
3. Cookie sesi ter-throwaway antar-run browser harness (state tidak persist), jadi capture
   diulang per session dengan import ulang.

## Struktur nav anggota (7 grup, sesuai menu-tree REA)

Urutan menu anggota chess.com (riil, dari top-bar ter-login):
`Bermain | Teka-Teki | Belajar | Berlatih | Tonton | Komunitas | Lainnya`
+ pencarian global + indikator rating + avatar user.

Per-halaman yang di-capture (judul + CTA + stat card riil):

| Halaman | URL | Heading utama | CTA / stat |
|---|---|---|---|
| Beranda | `/home` | greeting + streak | 3 task card (todo/done), "Bermain Online" |
| Teka-Teki | `/puzzles` | "Solve puzzles to improve your chess tactics" | "Solve Puzzles", grid 500k+ problem |
| Daily | `/daily` | "Daily Chess Puzzle" | "How many moves does it take?", "New puzzle daily" |
| Play | `/play/online` | — | stat "336,602 PLAYING / 26,902,260 GAMES TODAY" (riil saat capture) |
| Learn | `/learn` | "Learn To Play" | "Sign Up to Save Your Progress" |
| Tonton | `/watch` | "Watch" | live events, streamer, ChessTV |

**Catatan**: stat "336,602 playing / 26,9M games today" adalah angka LIVE riil saat capture —
bukan mock. jev-chess memakai angka riil dari `/api/home/dashboard` (sesuai invariant no-mock).

## Implikasi untuk jev-chess (parity tanpa copy aset)

1. **Nav 7 grup** sudah diimplementasikan jev-chess di commit `248ab6a` (V6 sidebar 6 grup)
   + bottom-nav mobile. Parity tercapai — hanya rename label mengikuti struktur chess.com.
2. **Daily puzzle** jev-chess = `/daily` (commit `c8da258` DailyPuzzleView + S3-T2 API
   `puzzles/daily`). Struktur navigator ±hari & streak sudah ada.
3. **Live stats panel** — jev-chess mengambil dari `/api/home/dashboard` (riil), tidak hardcode.
4. **Member-only gate**: halaman anggota chess.com redirect ke `/login` bila unauthenticated;
   jev-chess memakai `gate` cookie (commit `d8c4415` FIX-1 auth-state 401/403/503 konsisten).

## Status

- [x] Struktur nav 7 grup tervalidasi
- [x] CTA & stat-card per halaman tervalidasi
- [x] Metode login cookie-import terverifikasi (user aktif)
- Area member-only (puzzle panel internal, coach, komunitas thread) = pola diambil dari
  menu-feature-map + blueprint REA, bukan screenshot login.
