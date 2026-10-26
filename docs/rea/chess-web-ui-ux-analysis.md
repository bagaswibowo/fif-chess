# Chess-Web — Analisis UI/UX & Flow Semua Fitur (REA Runtime)

**Tanggal:** 2026-10-22 · **Metode:** Runtime authenticated (Camoufox) — DOM extraction per state (idle, setup modal, active play, solve mode) + network correlation dari `runtime-capture*.json` / `runtime-ws-capture.json`.
**Bahasa UI:** `id_ID` (mengikuti locale ACCESS_TOKEN) — copy di bawah adalah copy nyata chess.com.

---

## 0. Shell Global (berlaku semua halaman)

```
┌────────────────────────────────────────────────┐
│ [sidebar kiri, fixed, ~72px collapsed]         │
│  logo · Bermain(3) Teka-Teki Belajar Berlatih  │
│  Tonton Komunitas Lainnya · badge jumlah game  │
│  aktif inline di item nav ("Bermain 3")        │
├────────────────────────────────────────────────┤
│ [topbar] 🔍 Cari (global, muncul sbg H1 kedua  │
│  di SEMUA halaman = search-first)              │
│  kanan: "Uji Coba Gratis" (upsell permanen)    │
│  + avatar/username                             │
├────────────────────────────────────────────────┤
│ [main content — grid 2 kolom: board kiri,      │
│  panel kanan ~360px]                           │
└────────────────────────────────────────────────┘
```

Pola UX yang konsisten:
- **Board selalu kiri, panel interaksi selalu kanan** (desktop). Mobile: board atas, panel jadi bottom-sheet.
- **Upsell "Uji Coba Gratis" permanen** di topbar; paywall tidak menghalangi aksi dasar.
- **Badge realtime di nav** — angka "Bermain 3" di-update lewat pubsub `alert/alerts`.
- Semua halaman punya tombol **Pengaturan** (gear) konteks-lokal (board settings, bukan account settings).
- Modal konfirmasi cookie/privacy muncul sekali per sesi ("Tutup"/"Oke").

## 1. Home (`/home`) — Dashboard

**Struktur:** greeting + username → kartu task harian (3 CTA inline: "Jawab Teka-Teki", "Pelajaran Berikutnya", "Ulas Partai") → "Bermain Online" (daftar game aktif user) → feed.

**Flow utama:**
```
Landing → 3 kartu task harian (personalized, tiap kartu = 1 klik langsung ke aktivitas)
        → Section "Bermain Online": daftar game berjalan user
           tiap row: [waktu control] [lawan + rating] [status]
           + "Tambahkan ke Favorit" inline
           klik row → 2 tujuan: /game/live/<id> (main/spectate)
                                atau /analysis/game/live/<id>?tab=review (review)
        → Feed komunitas
```
**Insight UX:** task cards = engagement loop harian; game-row punya DUA aksi (main vs review) diekspose sekaligus — pemisahan play/analysis dibuat eksplisit sejak home.

## 2. Play Online (`/play/online`) — Pairing

**Struktur:** board di kiri (idle: kosong+preview) → panel kanan tabs **[Permainan Baru | Permainan | Pemain]**.

**Flow pairing:**
```
Tab "Permainan Baru"
  → time-control selector grid (preset chip: 1|3|5|10|15|30|60 mnt — chip "10 mnt" default)
  → tombol besar "Mulai Permainan" → seek masuk pool (WS matcher/tickets/users/:me)
  → status "Mencari lawan…" → match found → board aktif
"Tantangan Kustom" → modal: pilih lawan/waktu/warna/rating range
"Bermain dengan Teman" → friend picker → kirim challenge (WS incoming-challenges)
Tab "Permainan" → daftar game aktif user (3 teramati) + challenge masuk:
  row: [lawan] [Tolak Tantangan] [Terima Tantangan] — aksi inline, tanpa halaman perantara
Tab "Pemain" → directory pemain online → challenge langsung
```
**Live-lobby feedback (teramati WS):** counter sosial "216,609 Playing · 26,852,986 Games" — social proof saat menunggu. Toast/`Menghibur` untuk event lobby.

## 3. In-Game (`/game/live/<id>`) — State Aktif

**Panel kanan saat bermain (teramati di bot game, pola sama utk live):**
- Header: kedua pemain + rating + jam (`clocks: ['5:00','5:00']` — format m:ss)
- Move list vertikal (format: "Posisi Awal 1. e4" — numbered pairs, autoscroll)
- Kontrol bawah: **Menyerah · Urung (undo) · Tampilkan Petunjuk · Unduh · Pengaturan**
- Board: `--move-animation-duration: 180ms` (CSS var terukur — semua animasi bidak dinormalisasi), highlight last-move + 3 SVG arrows (premove/hint arrows)

**End of game:** auto-redirect offer ke `/analysis/game/live/<id>?tab=review` → **Game Review page** (teramati): heading "Ulasan Permainan", panel kontrol coach audio ("Aktifkan/Nonaktifkan Audio Pelatih"), CTA "Ke Analisis", favorit. → Konversi game→analysis dibuat otomatis.

## 4. Play Computer (`/play/computer`) — Setup Bot

**Flow:**
```
Landing: board + panel "Lawan Bot"
  → Bot picker: grid bot dengan persona ("Makhluk Misterius" = random persona)
    filter "Semua Bot", tiap bot: nama + rating (Martinfoot (250))
  → "Opsi": modal berisi
     · time control chips lengkap: 1|1+1|2+1|3+2|5|5+5|10|15+10|30|10+5|20|60|"Tidak ada pemasa"|"Standar" (14 preset)
     · skill level slider, warna, checkbox opsi (1 teramati: takeback/coach)
  → "Mulai" → game aktif dengan kontrol sama seperti live (Urung bebas vs bot)
```
**Catatan UX:** undo diizinkan vs bot (dilarang di live) — kontrol panel adaptif per mode game.

## 5. Puzzles (`/puzzles`) — Hub + Solve Mode

**Hub:** heading + 3 value-prop cards ("Selesaikan teka-teki untuk meningkatkan taktik…", "Tingkatkan keawasan dan pengenalan pola", "Belajar dan bersenang-senanglah dengan 500K+ teka-teki") → menu expand "+4" ("Perluas Menu Teka-teki": Rush, Battle, custom) → preview board.

**Solve mode flow:**
```
"Jawab Teka-Teki" → board aktif (id=board-primary) → puzzle side-to-move
  → click piece → click target → benar: bidak lawan auto-reply (animasi 180ms)
                    salah: board shake + retry
  → panel: rating puzzle user, streak counter ("2"), coach hint slot
  → upsell cross-feature muncul saat idle: "Ingin yang lebih cepat? Cobalah…
    Teka-Teki Gegas" (routing ke Rush)
  → selesai: stats update (callback/tactics/stats/user) + progression WS push
```

## 6. Puzzle Rush (`/puzzles/rush`)

**Landing:** 3 baris aturan eksplisit: "Selesaikan teka-teki sebanyak mungkin" / "dimulai dari yang mudah dan akan bertambah sulit" / "Jika gagal menjawab 3 kali, berakhir" — kontrak permainan dijelaskan SEBELUM mulai.
**Kontrol:** [Kembali] **[Bermain]** [Papan Peringkat] + durasi chip **[3 menit | 5 menit | Sintasan (endless)]**.
**Flow:** Bermain → timer mulai → puzzle beruntun, kesulitan naik adaptif → 3 strike = game over → skor + leaderboard.

## 7. Analysis (`/analysis`) — Router 6 Entri

Landing menampilkan **6 kartu pintu masuk** (arsitektur informasi eksplisit):
1. **Atur Posisi** (start board kosong)
2. **Analisis Baru** (new analysis)
3. **Koleksi Permainan** (organize)
4. **Pencarian Partai** (master games DB → `/games`)
5. **Jelajahi** (opening explorer)
6. **Simpanan Analisis** (saved)
7. **Ruang Kelas** (collab analyze)

Plus satu input universal di atas: *"Paste a PGN, FEN, or study link…"* — fast path: paste → langsung board analisis. **Insight:** 6 kartu + 1 paste bar = power users tidak pernah lebih dari 2 klik.

## 8. Lessons (`/lessons`) — Guided Learning

Teramati deep-link langsung ke lesson aktif (`/lessons/pembukaan-lanjutan/serang-di-pusat` — kategori/slug).
**Kontrol lesson:** [Kembali] · **Toggle Lesson Audio** · **[Mulai]** · [Bagikan].
Board lesson = interactive (user melangkah sesuai instruksi), bukan video pasif — dengan audio coach (sama engine TTS dengan Game Review coach).

## 9. Turnamen/Arena (`/tournaments`)

**Struktur:** hero copy ("Berkompetisilah di turnamen online atau ikuti Arena…") → seksi: "Turnamen Langsung Berikutnya" + daftar arena live.
**Row arena:** [nama] [countdown "Dimulai"/menit] [status 0/3…] → tombol **[Bergabung]** inline → `/play/arena/<id>`.
Data arena realtime via pubsub `tournaments/standings|games/users/:me`.

## 10. Profil (`/member/<username>`)

**Struktur:** avatar + status editor ("Tambah status", "Masukkan status di sini") → tabs **[Ikhtisar | Permainan | Statistik | Teman | Penghargaan | Klub]** → leaderboard rating per kategori: counters "400" (puzzle), "304 +33 games" (cepat), "187 +10" (kilat) → widget game aktif + favorit → friend requests inline [Tolak|Terima].
**List/Grid toggle** untuk konten aktivitas.

## 11. Arsip Game (`/games/archive/<user>`)

**Filter tabs:** [Semua | Favorit | Langsung | Harian | Bot | Pelatih] + search + sort "Tanggal: Terbaru Dahulu" + view toggle **[Tampilan Utuh | Singkat]** + counter total "Semua Permainan (783)".
**Row game:** [control] [lawan+rating] [delta rating ±] [hasil 0/1] + aksi: Favorit, "Menganalisis", "Unduh", "Tambahkan ke Koleksi Permainan", "Tampilkan Penanda Waktu" (timestamp toggle), "Pilih Semua" (bulk).

## 12. Sistem Transversal

| Sistem | Perilaku teramati |
|---|---|
| **Toasts** | channel pubsub `toasts/users/<uuid>/notices` + `toasts/updates` — notif non-blocking, ID `#608390671:ts` |
| **Challenges** | selalu inline dual-button [Tolak|Terima] di home, play/online, profil — TIDAK ada halaman antara |
| **Upsell** | 3 lapis: topbar permanen, idle-prompt kontekstual (puzzle→rush), gate fitur premium tanpa memblokir P0 |
| **Search** | global topbar, tabindex pertama (skip-link "Lewati ke konten" = a11y) |
| **Realtime badge** | nav "Bermain N" — websocket-driven |
| **i18n** | seluruh copy id_ID, locale-aware ChessTV schedule |
| **A11y** | skip-to-content link, aria-label luas (icon-only buttons), dialog role |

## 13. Peta Flow Antar-Fitur (graph)

```
                    ┌──────────┐
        landing ──► │  /home   │──► task cards ─► puzzles/lessons/review
                    └─┬───┬────┘
              game row│   │quick pairing
        ┌─────────────▼┐ ┌▼──────────────┐
        │ /game/live/* │ │ /play/online  │◄─ challenges (WS)
        └──┬───────┬───┘ └───────┬───────┘
     playing│       │review       │arena
            │  ┌────▼────────┐  ┌─▼──────────┐
            │  │ /analysis/* │  │ /play/arena│
            │  └────┬────────┘  └────────────┘
            ▼       │
      end-game ─────┘ (auto-redirect ke review)
        │
   /games/archive (bulk analyze/download)
```

## 14. Rekomendasi Porting chess-web (UX)

1. Salin **pola board-kiri/panel-kanan + tabs** (pairing: Baru|Permainan|Pemain) — terbukti sudah, jangan diimprovisasi.
2. Wajib ada: inline dual-button challenge, task cards home, auto-redirect end-game→review, paste-PGN fast path di analysis.
3. Animasi bidak dinormalisasi via CSS var (`--move-animation-duration: 180ms`).
4. Realtime badge nav + toasts = konsumen pubsub yang sama dengan backend (satu topik satu konsumen).
5. Upsell: idle-contextual saja, jangan modal-blocking.
6. A11y floor: skip-link, aria-label icon buttons, focus-visible — chess.com sendiri memakai pola ini.

## 15. Artefak
- `ui-capture.json` (6 halaman idle) · `ui-capture2.json` (live-game review, puzzle hub, lessons, tournaments, computer setup) · `ui-capture3.json` (bot game active, puzzle solve, profile, archive) — semua di dev VPS dan sxz.
