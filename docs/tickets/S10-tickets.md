# S10 Tickets: Parity Implementation & Architecture Hardening

> Breakdown Tiket oleh Sub-Agent PM & Tech Lead  
> Status: ready-for-agent  
> Referensi: docs/tickets/S10-parity-spec.md

---

## T1 [P0 · Blocker] — Centralize Authentication via Deep Module `lib/route-auth.ts`
**What to build:**
Satu fungsi `routeAuth(req: Request)` di `lib/route-auth.ts` yang menangani resolusi token, pemetaan PG UUID, status akun (`approved`, `pending`, `rejected`), dan deteksi DB timeout (503). Seluruh API route mengonsumsi modul ini daripada menulis inline logic `NextResponse.json({ error: ... }, { status: 401 })`.

**Blocked by:** None (can start immediately)
**Acceptance criteria:**
- [ ] `lib/route-auth.ts` mengekspor `routeAuth(req)` dan `pgIdByUsername(username)`
- [ ] Mengembalikan tuple/result yang konsisten: `{ ok: true, user }` atau `{ ok: false, response: NextResponse }`
- [ ] 401 mengembalikan struktur `{ error: "unauthorized", code: "auth_required" }`
- [ ] 403 pending mengembalikan `{ error: "forbidden", code: "account_pending" }`
- [ ] Tidak ada duplikasi fungsi pemetaan username ke UUID di routes yang dimigrasi

---

## T2 [P0] — Home & Lobby Visual Parity with Tactile Time Control Grid
**What to build:**
Perbarui `home-view.tsx` dan `pvp-panel.tsx` agar menyelaraskan tata letak 3-kolom Chess.com:
- Kolom Kiri: Quick Play Cards (Bullet 1m, Blitz 3m/5m, Rapid 10m/30m) dengan efek bevel 3D `#81b64c`
- Kolom Tengah: Highlight partai harian / papan interaktif taktik
- Kolom Kanan: Streak harian + Progres Belajar + Mini Leaderboard

**Blocked by:** T1
**Acceptance criteria:**
- [ ] Grid seleksi waktu menampilkan pill visual dengan icon dan time-increment yang jelas
- [ ] Streak harian terbaca dari `/api/home/dashboard` dengan ikon api berkilau
- [ ] Responsive dari mobile 360px hingga desktop 1440px tanpa overflow horizontal

---

## T3 [P1] — Unified Tactical Puzzle Solver & Arrow Hint Hierarchy
**What to build:**
Sinkronkan `puzzle-solver.tsx` dengan pengalaman teka-teki Chess.com:
- Sistem petunjuk berjenjang (Level 1: Highlight kotak asal, Level 2: Panah arah langkah, Level 3: Buka solusi penuh beranimasi)
- Counter benar/salah taktil instan dengan efek haptik visual DHH

**Blocked by:** T1
**Acceptance criteria:**
- [ ] Tombol Petunjuk memunculkan Arrow SVG pada papan catur sesuai move index yang benar
- [ ] Tombol Solusi memainkan variasi hingga akhir tanpa error uncaught exception
- [ ] Tidak ada lompatan stepIndex ganda pada timer auto-reply lawan

---

## T4 [P1] — OTB Scanner to Analysis Board Direct Pipeline
**What to build:**
Jembatan 1-klik dari hasil deteksi kamera/foto fisik papan catur di `scan-view.tsx` menuju `game-review.tsx` (Stockfish 19 NNUE Analysis Board).

**Blocked by:** T2
**Acceptance criteria:**
- [ ] Setelah YOLO11 / Chesscog mengembalikan FEN yang valid, tombol "Buka di Papan Analisis" langsung memuat FEN tersebut di `game-review.tsx`
- [ ] Evaluasi engine Stockfish langsung aktif menghitung evaluasi posisi OTB tersebut
- [ ] Papan dapat di-flip (Putih/Hitam) sesuai sudut pandang pengambilan foto

---

## T5 [P2] — DHH Audio-Visual Cue & High-Contrast Mode Hardening
**What to build:**
Penguatan aksesibilitas DHH pada `clock-moves-fullscreen.tsx` dan `board-chrome.tsx`:
- Indikator visual urgency saat sisa waktu < 10 detik (border pulse warna amber-ke-merah)
- `aria-live="polite"` untuk setiap notasi langkah catur yang dieksekusi

**Blocked by:** T2, T3
**Acceptance criteria:**
- [ ] Saat waktu kritis, visual flashing berjalan mulus dan tetap patuh pada `prefers-reduced-motion`
- [ ] Pembaca layar (screen reader) dapat membaca notasi langkah terkini secara akurat
