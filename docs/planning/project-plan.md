# Jev-Chess Project Plan — Port Fitur Chess.com ke Web

**Sumber:** REA MCP decompilation chess.com v4.10.20 (`com.chess`, 57.929 kelas)
**Target:** `xz@sxz:~/projects/active/jev-chess/` (Next.js 16, Tailwind v4, shadcn, Stockfish 19 NNUE)
**Timeline:** 8 minggu, 6 milestone

---

## Milestone Overview

| ID | Nama | Minggu | Tugas | Status |
|----|------|--------|-------|--------|
| M1 | Fondasi & Autentikasi | 1-2 | T04, T02, DB-01 | planned |
| M2 | Fitur Intian Permainan | 3-4 | T01, T03, T05 | planned |
| M3 | Teka-teki, Quest & Review | 5-6 | T10, T11, T12 | planned |
| M4 | Basis Data & Persistensi | 5-6 | DB-02 | planned |
| M5 | QA, Aksesibilitas & Loop Review | 7 | QA-01, QA-02, QA-03, A11-01 | planned |
| M6 | DevOps, Deploy & Persetujui TL | 8 | DEVOPS-01, DEVOPS-02, TL-01 | planned |

---

## Daftar Tugas Lengkap

### M1 — Fondasi & Autentikasi

**T04** — Design system & UI responsif (P0, 24 jam)
- Satu design system untuk seluruh komponen: ukuran tombol konsisten, tipografi yang terbaca, layout dinamis tidak tumpang tindih/terpotong di HP maupun desktop (Tailwind v4 + shadcn).
- Dependensi: tidak ada.

**DB-01** — Skema basis data: users, games, pvp_rooms, puzzles, game_history (P0, 24 jam)
- Desain skema PostgreSQL untuk pengguna, riwayat permainan, ruangan PvP, teka-teki, dan riwayat langkah.
- Dependensi: tidak ada.

**T02** — Autentikasi: daftar & login + persetujuan admin (P0, 20 jam)
- Halaman daftar dan login untuk komunitas. Setiap pendaftaran harus disetujui oleh admin (Pak Bagas) sebelum user bisa bermain.
- Dependensi: DB-01.

### M2 — Fitur Intian Permainan

**T01** — PvP Online — undang lawan pemain nyata via username (P0, 16 jam)
- Tombol 'Lawan Pemain Nyata' pada halaman bermain; user dapat mengundang lawan melalui username, membuat ruangan PvP, dan menunggu lawan gabung.
- Dependensi: T02, DB-01.

**T03** — Pemilihan warna (putih/hitam) ditampilkan di bawah bidang, konsisten semua menu (P1, 8 jam)
- Saat memilih lawan, pengguna memilih mau putih atau hitam; pilihan ditampilkan di bawah bidang. Konsisten di semua menu permainan.
- Dependensi: T04.

**T05** — Tampilan layar penuh: hanya jam dan riwayat langkah (P1, 12 jam)
- Mode layar penuh yang hanya menampilkan waktu (jam) dan riwayat langkah permainan, tanpa elemen lain yang mengganggu.
- Dependensi: T04.

**T06–T09** — API engine-move, scan-board/jev-move, status/gate/rate limiting, engine teka-teki (13 teka-teki)
- **Sudah selesai (done).** Implementasi ada di `lib/chess-com-engine.ts`, `lib/threat-detection.ts`, `lib/post-game-analysis.ts`, `lib/bot-chat.ts`, `lib/opening-book.ts`, `lib/extra-security.ts` + 6 API route di `app/api/`.

### M3 — Teka-teki, Quest & Review

**T10** — Perbanyak teka-teki hingga 50 + kategori dan tingkat kesulitan (P1, 20 jam)
- Sempurnakan bagian teka-teki, perbanyak dari 13 hingga 50, lengkapi kategori dan tingkat (Mudah/Sedang/Sulit).
- Dependensi: T09.

**T11** — Review blunder: riwayat permainan, pratinjau tabel, urutkan tanggal & jam (P1, 16 jam)
- Riwayat permainan user, pratinjau dalam bentuk tabel di lain tap, dan diurutkan berdasarkan terakhir kali bermain dengan tanggal dan jam.
- Dependensi: T01, T02, DB-01.

**T12** — Quest & teka-teki: gabungkan jika sama, pertahankan jika berbeda (P2, 16 jam)
- Belajar quest dan teka-teki; jika sama digabungkan menjadi satu, jika berbeda dipertahankan terpisah.
- Dependensi: T10.

### M4 — Basis Data & Persistensi

**DB-02** — Migrasi localStorage / in-memory rooms ke PostgreSQL (P0, 16 jam)
- Pindahkan semua penyimpanan (user, permainan, ruangan PvP) dari localStorage dan in-memory Map ke basis data agar persisten.
- Dependensi: DB-01.

### M5 — QA, Aksesibilitas & Loop Review

**QA-01** — Unit test (vitest): logika perpindahan & validasi papan (P1, 12 jam)
- Tes unit untuk logika gerak bidak, validasi papan, dan utilitas catur dengan vitest.
- Dependensi: T04.

**QA-02** — Integration test: alur PvP room dan autentikasi (P1, 12 jam)
- Tes integrasi untuk alur daftar/login, pembuatan ruangan PvP, undangan lawan, dan selesainya permainan.
- Dependensi: T01, T02, DB-02.

**QA-03** — AI-review loop setelah setiap fitur selesai kode (P2, 16 jam)
- Setiap selesai coding melakukan AI-review (loop engineering) sebelum melanjutkan fitur berikutnya.
- Dependensi: tidak ada.

**A11-01** — Audit aksesibilitas DHH: layar penuh, kontras, navigasi keyboard (P1, 12 jam)
- Pastikan tampilan layar penuh, kontras warna, dan navigasi keyboard dapat diakses pengguna DHH.
- Dependensi: T04.

### M6 — DevOps, Deploy & Persetujui TL

**DEVOPS-01** — Dockerfile + docker-compose produksi (P1, 12 jam)
- Siapkan Dockerfile dan docker-compose untuk deployment produksi pada sxz-server.
- Dependensi: DB-02.

**DEVOPS-02** — CI/CD pipeline: build, test, deploy ke sxz-server (P1, 12 jam)
- Konfigurasi CI/CD untuk menjalankan build, uji, dan deploy otomatis ke sxz-server melalui NetBird SSH.
- Dependensi: DEVOPS-01.

**TL-01** — Tech Lead review & sign-off arsitektur (P0, 12 jam)
- Review akhir oleh Tech Lead: arsitektur, kode, keamanan, dan persetujui sebelum rilis produksi.
- Dependensi: semua tugas di atas.

---

## Arsitektur (Ringkasan dari Sub-Agent Arsitek)

**Layered Architecture (Clean Architecture):**
- `domain/` — chess murni, tanpa dependensi framework
- `application/` — use case/service, ports (interfaces), DTO
- `infrastructure/` — Stockfish UCI adapter, chess.js adapter, session/gate, HTTP handler
- `presentation/` — Next.js App Router + react-chessboard components

**Seams utama:**
1. Transport seam: Next.js API Route → Application Service (validasi zod di lib/validations.ts)
2. Application seam: Application Service → Domain entity (tidak impor infrastruktur)
3. Engine seam: StockfishEnginePort → StockfishUciAdapter (satu proses panjang umur dengan antrian perintah)
4. Board seam: ChessBoardPort → ChessJsAdapter
5. Session/Gate seam: SessionStorePort → MemorySessionStore (dev) / RedisStore (prod)
6. Presentation seam: React Client Component → Application via hooks

**Tech stack:** Next.js 16 App Router, React 19, Tailwind v4 + shadcn/ui, chess.js, react-chessboard, Stockfish 19 NNUE via UCI IPC, zod validation, cookie jev_gate + HMAC gate, PostgreSQL (produksi), Docker multi-stage, Cloudflare Tunnel http2.

---

## Design System (Ringkasan dari Sub-Agent Desainer)

**Palette:** Charcoal #312e2b (arena), Panel #262421 (card), Wood Light #f0d9b5 (petak terang), Wood Dark #b58863 (petak gelap), Accent Green #81b64c (langkah baik), Ink #e8e4d8 (teks utama), Muted #a69e8f (teks sekunder), Border #5c554b (pemisah), Ring Focus #81b64c (focus ring), Alert #c96a2e (blunder).

**Tipografi:** Display = Playfair Display (serif, headings), Body = Source Serif 4 (serif, long-form), Mono = JetBrains Mono (SAN/FEN, clock, eval).

**Layout:** Paparan panggung catur simetris — rail evaluasi kiri, papan tengah, strip pemain atas/bawah, controls bawah. Mobile-first dengan bottom navigation 5 item, PWA-ready, safe-area aware.

**Signature Element:** Notasi Aljabar Ribbon — strip notasi gerak (e4, Nf3, O-O) berjalan vertikal di sisi papan pada mobile dan horizontal di desktop, dengan simbol kualitas (!!/!/★/✓/?!/?/??/x) dari CAPS analysis.

---

## Skema Database (Ringkasan dari Sub-Agent Database)

Tabel: `users`, `games`, `game_moves`, `analysis_results`, `puzzles`, `puzzle_attempts`, `extra_security_sessions`, `rate_limits`.

Relasi utama:
- users 1:N games (putih & hitam)
- games 1:N game_moves (ON DELETE CASCADE)
- games 1:1 analysis_results (UNIQUE, ON DELETE CASCADE)
- users 1:N puzzle_attempts, puzzles 1:N puzzle_attempts
- users 1:N extra_security_sessions

Migrasi: inventarisasi JSON lama → buat database PostgreSQL → skrip migrasi Node/Prisma → hilangkan redundansi → validasi integritas → ganti lapisan data dengan Prisma Client → arsipkan JSON lama.

---

## QA & Testing (Ringkasan dari Sub-Agent QA)

Strategi layered: Unit (vitest, mock Stockfish) → Integration (supertest, Next.js test server) → E2E (Playwright). Stockfish testing terpisah dengan binary sebenarnya, timeout guard, deterministic check, graceful degradation, UCI lifecycle.

Test files yang perlu dibuat: 6 lib test + 6 API route test + 1 e2e test.

Release checklist mencakup: tsc lolos, semua test lolos, Stockfish tersedia dan merespons uciok, validateFen di semua endpoint FEN, UCI synchronized lock, tidak ada zombie Stockfish, HMAC timingSafeEqual, extra security 5x gagal → invalidated, PGN tidak crash, error response konsisten, tidak ada secret di log, load test 10 request concurrent, dokumentasi API, rollback plan, monitoring/alerting.

Bug yang ditemukan (20 items) mencakup: duplikasi jev-v2/v3, Authorization header placeholder, silent catch {}, spawn-per-call Stockfish, in-memory securityStore, uciLock boolean, fetch tanpa timeout, opening book hanya history, validasi FEN hardcode true, PGN parsing naive, deltaCp tanpa side-to-move flip, isPassedPada false positive, // @ts-ignore, blending weights hardcoded, SF_BIN hardcoded, apiKey type `***`, FlyBrain health check, tidak ada rate limiting/CORS/security headers, tidak ada test, duplikasi ChessBoard di view-files.

---

## DevOps (Ringkasan dari Sub-Agent DevOps)

**CI/CD steps:** checkout → setup Node 20 → npm ci → lint → test → (push main) login GHCR → setup Buildx → build & push image ke ghcr.io.

**Deploy steps:** ssh sxz via NetBird → git pull → .env (TUNNEL_TOKEN, ADMIN_PASSWORD, SITE_HMAC_KEY, SITE_PASSWORD_HMAC) → docker compose build app → docker compose up -d → cloudflared --protocol http2 → verify.

**Dockerfile:** multi-stage (deps → builder → runner), install stockfish via apt, copy .next/standalone, expose port 43173.

**Tunnel config:** cloudflared dengan --protocol http2, ingress http2://localhost:43173, tunnel token dari env TUNNEL_TOKEN.

---

## Tech Lead Review — Status: REJECTED (belum production ready)

20 issue ditemukan, 5 critical:

**Critical:**
- JEV-001: Duplikasi jev-v2.ts (382 baris) vs jev-v3.ts (523 baris) — consolidate menjadi satu module kanonis
- JEV-002: Authorization header placeholder `*** ${apiKey}` bukan `Bearer ${apiKey}`
- JEV-003: Silent `catch {}` menelan error tanpa log/trace
- JEV-004: Spawn-per-call Stockfish, tidak ada connection pooling, risiko file descriptor leak
- JEV-005: `securityStore` in-memory Map, hilang saat restart, tidak aman multi-instance

**Production Gate Criteria (harus terpenuhi sebelum deploy):**
- Kode duplikasi dihapus (satu sumber kebenaran logika JEV)
- Semua API routes memiliki input validation, rate limiting, error response konsisten
- Stockfish menggunakan connection pool / persistent process (bukan spawn-per-request)
- UCI engine access menggunakan antrian request (queue), bukan boolean lock
- Security store menggunakan Redis/Database (bukan in-memory Map)
- Tidak ada silent `catch {}`
- Semua fetch memiliki timeout (AbortController)
- Test coverage > 80%
- TypeScript strict mode, tidak ada `any` atau placeholder `***`
- Environment variables untuk semua path/secret/k.config
- Health check endpoint (FlyBrain model + Stockfish tersedia)
- Security headers (CORS, CSP) pada semua API routes
- FEN validasi eksplisit (tidak ada `valid = true` hardcode)
- PGN parsing menggunakan library teruji
- Delta Cp calculation diverifikasi dengan test side-to-move flip

---

**Catatan operasional:**
- scp/sftp ke sxz-server broken (NetBird privilege dropper panic). Transfer file via `cat file | ssh sxz-server 'cat > path'`.
- Jangan jalankan Java/JADX langsung di sxz-server (RAM 7.8GB, 0-swap → OOM). Gunakan REA MCP di host Hermes (heap 4608 MiB sudah aktif).
- Laporan REA detail sudah ada di `xz@sxz:~/projects/active/chess-rea/chess-com-4.10.20-rea-report.md`.
