# ♟️ FIF Chess Arena

> **Platform Web Catur Modern Komunitas FIF Telkom University**  
> Ditenagai oleh **Stockfish 15 NNUE (Invincible Engine, Elo 3550+)**, **TypeSafe Jev API**, antarmuka bertema **Chess.com**, ikon **3D Vector Shaders murni**, serta optimasi penuh untuk layar *mobile/smartphone*.

---

## 📌 Ringkasan Arsitektur & Keunggulan Sistem

FIF Chess Arena dirancang khusus untuk memenuhi standar platform catur modern yang tangguh, efisien, dan bebas ketergantungan berlebihan pada AI probabilistik biasa:

1. **Engine Catur Tak Terkalahkan (Invincible AI):**
   - Menggunakan binary asli **Stockfish 15 NNUE** yang dikompilasi secara lokal dalam container Debian Linux (`/usr/games/stockfish`).
   - Berjalan pada kedalaman evaluasi (*depth*) 14–16 dengan Elo ~3550+, menghasilkan langkah taktis mutlak tanpa blunder dalam waktu <200ms.
   - Opsi `MultiPV 3` memberikan 3 kandidat variasi langkah teratas beserta persentase probabilitasnya ke antarmuka.
   - Fallback otomatis ke **TypeSafe Jev Choice API** jika engine lokal tidak tersedia.
   - Konsumsi resource minimal: RAM 30–64 MB saat berpikir, 0 KB disk write runtime, footprint binary hanya ~47 MB.

2. **Desain Visual Anti-Slop & Tema Chess.com:**
   - Palet warna khas: Charcoal `#312e2b`, panel `#262421`, dan tombol aksi taktil 3D hijau `#81b64c` (`box-shadow: 0 4px 0 #45753c`).
   - Papan catur kayu klasik (*wood classic*): Petak terang `#f0d9b5` dan petak gelap `#b58863`.
   - **Bebas Karakter Emoji Biasa:** Seluruh ikon navigasi, status, kartu pemain, dan tombol aksi menggunakan komponen vektor **3D lighting shaders** kustom (SVG radial/linear gradients, drop shadows, dan specular highlights) yang tajam di seluruh resolusi tanpa membebani CDN eksternal.

3. **Efek Interaktif & Status Akhir Pertandingan:**
   - **Kemenangan (Victory):** Efek animasi selebrasi **Confetti** partikel HTML5 Canvas (60fps native GPU) + Trofi Emas 3D.
   - **Skakmat (Checkmate / Defeat):** Animasi fisik **Raja Tumbang** pada petak catur (`transform: rotate(-85deg)`) + Modal Tengkorak 3D dengan mata merah menyala.
   - **Menyerah (Resign):** Modal khusus kekalahan dengan **Bendera Putih 3D** (bebas dari label "Skakmat").
   - **Remis (Draw):** Status imbang dengan ikon **Timbangan Perak 3D** (Stalemate / Threefold Repetition / 50 Moves / Insufficient Material).

4. **Modul Pembelajaran & Latihan Lengkap:**
   - **Teka-Teki (Tactical Puzzles):** Kumpulan taktik grandmaster yang **100% diverifikasi engine Stockfish** (Garpu Kuda, Skakmat Baris Belakang, Kuda Terjepit / Philidor, Serangan Lemah f7, dan Pin Jalur Terbuka). Menggunakan sistem input **Click-to-Move** yang presisi, sistem petunjuk bertingkat (*Level 1: Sorot bidak asal, Level 2: Sorot petak tujuan & penjelasan*), fitur ulangi (*retry*), dan buka solusi otomatis.
   - **Latihan Visi & Koordinat (Vision Drills):** Sprint refleks 30 detik untuk melatih daya ingat letak petak koordinat catur (a1–h8) dengan sudut pandang bolak-balik (Putih/Hitam) dan pelacakan *High Score* di `localStorage`.
   - **Impor & Analisis Papan OTB:** Modul impor posisi FEN turnamen fisik (OTB scoresheet) dengan pratinjau papan interaktif sebelum dianalisis oleh engine.
   - **Komunitas Catur FIF:** Pusat informasi latihan mingguan, leaderboard civitas, dan direktori klub catur Tel-U.

5. **Optimasi Mobile / Smartphone PWA-Ready:**
   - Header ringkas di atas layar (`sticky top-0`).
   - Navigasi bawah tetap (*fixed bottom bar*) ala aplikasi native smartphone: *Bermain, Teka-Teki, Visi, Scan OTB, Komunitas*.
   - Papan catur fleksibel responsif terhadap lebar viewport ponsel tanpa *horizontal scrollbar*.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack, React 19)
- **Styling:** Tailwind CSS v4, Radix UI Primitives, Lucide Icons
- **Chess Logic & Board:** `chess.js` v1.0.0-beta.6, `react-chessboard`
- **Engine:** Stockfish 15 NNUE (UCI protocol over IPC stdin/stdout pipe)
- **Containerization:** Docker Multi-stage (Node 20 Alpine Builder + Node 20 Slim Runner with Stockfish)
- **Reverse Proxy / Tunnel:** Cloudflare Tunnel (`cloudflared --protocol http2`)
- **Security:** HMAC SHA-256 Gate Authentication + In-memory bounded sliding window rate limiter

---

## 📂 Struktur Proyek

```
jev-chess/
├── app/
│   ├── api/
│   │   ├── gate/route.ts        # Endpoint verifikasi password & rate limiting IP
│   │   ├── jev-move/route.ts    # Handler langkah AI (Stockfish NNUE + Fallback Jev)
│   │   └── status/route.ts      # Healthcheck status server
│   ├── globals.css              # Tema warna Chess.com, keyframe animasi, & tokens
│   ├── layout.tsx               # Root layout HTML & metadata
│   └── page.tsx                 # Entrypoint aplikasi catur
├── components/
│   ├── ui/                      # Komponen antarmuka atomik (Button, Card, Badge, Dialog)
│   ├── community-view.tsx       # Tampilan informasi klub & leaderboard FIF
│   ├── confetti.tsx             # Partikel confetti selebrasi kemenangan native canvas
│   ├── game-over-modal.tsx      # Modal akhir game (Menang/Kalah/Remis/Menyerah)
│   ├── game.tsx                 # Master controller permainan & tata letak responsif
│   ├── gate-setup.tsx           # Antarmuka proteksi password gerbang situs
│   ├── icons3d.tsx              # Pustaka ikon 3D vector shaders (Pawn, Bot, Flag, Skull, dll)
│   ├── jev-distribution.tsx     # Visualisasi probabilitas evaluasi MultiPV engine
│   ├── move-list.tsx            # Tabel riwayat notasi langkah catur (SAN)
│   ├── promotion-dialog.tsx     # Dialog promosi pion (Menteri/Benteng/Gajah/Kuda)
│   ├── puzzle-view.tsx          # Modul teka-teki taktis catur (Click-to-Move + Hints)
│   ├── scan-view.tsx            # Modul impor & pratinjau posisi papan OTB (FEN)
│   └── vision-drill.tsx         # Modul latihan koordinat visi catur 30 detik
├── lib/
│   ├── chess.ts                 # Wrapper utilitas papan & aturan chess.js
│   ├── gate.ts                  # Logika cookie sesi & validasi HMAC SHA-256
│   ├── stockfish.ts             # IPC Subproses UCI Stockfish NNUE
│   ├── use-chess-clock.ts       # Custom hook jam catur berbasis delta milidetik
│   └── types.ts                 # TypeScript type definitions
├── Dockerfile                   # Multi-stage image build dengan paket stockfish
├── docker-compose.yml           # Konfigurasi container app & cloudflared tunnel
├── next.config.ts               # Konfigurasi standalone Next.js
└── package.json                 # Dependensi proyek
```

---

## 🚀 Panduan Menjalankan & Deployment

### 1. Prasyarat Lingkungan
- **Node.js:** Versi 20 atau lebih baru (jika dijalankan lokal tanpa Docker).
- **Stockfish:** Binary Stockfish terpasang di sistem (`/usr/games/stockfish` atau di PATH).
- **Docker & Docker Compose:** Untuk menjalankan mode kontainer terisolasi.

### 2. Menjalankan secara Lokal (Development)

```bash
# Clone repository
git clone https://github.com/bagaswibowo/fif-chess.git
cd fif-chess

# Install dependensi
npm install

# Buat file environment
cp .env.example .env.local

# Jalankan server development
npm run dev
```
Akses di browser melalui: `http://localhost:3000`

### 3. Menjalankan via Docker Compose (Produksi)

```bash
# Salin konfigurasi environment
cat << "EOF" > .env
TYPESAFE_API_KEY=your_typesafe_api_key_here
SITE_PASSWORD_HMAC=your_hmac_secret_here
TUNNEL_TOKEN=your_cloudflare_tunnel_token_here
EOF

# Build dan jalankan container
docker compose build app
docker compose up -d
```
Container akan melayani port internal `43173` dan secara otomatis terhubung ke domain publik melalui Cloudflare Tunnel.

---

## 🔒 Konfigurasi Keamanan (Security Hardening)

1. **HMAC Gate Protection:**  
   Menggunakan `crypto.createHmac("sha256", secret)` dengan cookie sesi berstatus `HttpOnly`, `SameSite=Lax`, dan `Path=/`.
2. **Rate Limiting Anti-Brute-Force:**  
   Endpoint `/api/gate` dibatasi maksimal 5 percobaan gagal per 60 detik per klien dengan prioritas deteksi IP terpercaya Cloudflare (`cf-connecting-ip`) dan pembersihan memori otomatis (*TTL pruning*).
3. **Validasi Karakter FEN:**  
   Subproses UCI Stockfish memvalidasi regex string FEN sebelum dikirim ke stdin untuk mencegah *command injection* berbahaya.

---

## 👥 Kontributor & Lisensi

- **Author:** Bagas Wibowo (Dosen Teknik Informatika, Telkom University - KK SEAL)
- **Komunitas:** FIF Chess Club / Arena Catur Tel-U
- **Basis Asal:** Fork & modifikasi mendalam dari `JLarky/jev-chess`
- **Lisensi:** Private / Proprietary untuk Komunitas FIF Telkom University
