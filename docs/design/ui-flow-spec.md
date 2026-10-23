# UI Flow Spec — jev-chess (Workstream-2, eksekusi-ready)

Ditujukan untuk Web/Backend Dev. Semua komponen React/Next di `components/`.
Aksesibilitas DHH binding: cue visual + teks selalu berpasangan, tidak pernah audio-only;
setiap region status pakai `aria-live`; fokus keyboard selalu terlihat; animasi hormati
`prefers-reduced-motion: reduce` (guard global via hook `useReducedMotion()`).

---

## 1. Komponen baru / diubah

| Komponen | Aksi | Tujuan |
|---|---|---|
| `components/ui/state-message.tsx` | BARU | Satu komponen empty/loading/error/pending. Props: `kind`, `message`, `detail?`, `onRetry?`, `code?`. |
| `components/ui/time-control-picker.tsx` | BARU | Preset jam + custom. |
| `components/ui/auth-status-badge.tsx` | BARU | Badge status akun: "Approved" (hijau), "Menunggu persetujuan" (kuning), "Guest" (abu). Ikon + teks. |
| `components/shell/app-shell.tsx` | UBAH | Tampilkan AuthStatusBadge di sidebar profil & header mobile; heading sr-only per grup nav; focus-trap di sheet Lainnya. |
| `components/views/{friends,leaderboard,archive,endgame-drills}-view.tsx` | UBAH | Ganti mapping error manual dengan `state-message`; hapus semua string "Masuk untuk melihat...". |
| `components/pvp-panel.tsx`, `components/game.tsx` | UBAH | Sama; plus time-control picker di invite. |
| `components/game-over-modal.tsx` | UBAH | Tambah tombol Rematch, Tawari Remis, Bunuhdiri (konfirmasi 2-tahap). |
| `components/views/home-view.tsx` | UBAH | Tambah daftar tantangan masuk/keluar (challenge-card) dengan countdown. |
| `components/views/puzzle-view.tsx` | UBAH | Filter tema + rentang rating; panel stats pribadi. |
| `components/views/game-review.tsx` | UBAH | Skor akurasi per pemain; daftar langkah kritis klikabel. |

## 2. State machine auth (satu kontrak untuk SEMUA view)

Backend (FIX-1.1) mengirim salah satu:
- belum login → `401 {error}` → UI: tombol "Masuk" (buka auth-panel).
- pending/rejected → `403 {error, code:"account_pending"}` → UI: StateMessage kind=pending:
  judul "Akun menunggu persetujuan admin", ikon jam (bukan gembok), teks penjelasan,
  TIDAK ada tombol masuk. `role="status" aria-live="polite"`.
- server/db gagal → `503` → StateMessage kind=error + tombol "Coba lagi" (retry fetch
  dengan backoff; disable saat retry berjalan; `aria-busy`).
- sukses → render konten.

Hook bersama `useAuthedFetch(url)` mengembalikan `{data, state: 'loading'|'ready'|'guest'|'pending'|'error', retry}` —
semua view WAJIB memakai ini (menghapus 4 mapping manual; mendukung FIX-1.4 satu useSession).

### Contoh spec — friends-view
- loading: skeleton 3 baris kartu, `role="status"` "Memuat daftar teman…".
- guest: StateMessage guest + tombol "Masuk" (fokus pindah ke tombol).
- pending: StateMessage pending (lihat atas).
- error: pesan generik + "Coba lagi" + kode error dalam `sr-only`.
- empty: "Belum punya teman" + tombol "Cari pemain" (buka modal pencarian).
- ready: list; tiap baris: avatar inisial (teks), username, presence dot (hijau/abu) +
  `<span class="sr-only">Online</span>`, tombol "Tantang" (buka TimeControlPicker),
  tombol hapus (konfirmasi 2-tahap inline: "Yakin?" muncul menggantikan tombol 3 dtk).

## 3. TimeControlPicker (PvP invite & quick pairing)
- Preset chip: 1+0 Bullet, 3+0 Blitz, 3+2 Blitz, 5+0 Blitz, 10+0 Rapid, 15+10 Rapid,
  + "Kustom" membuka 2 spinner menit/inkremen. `role="radiogroup"`, arrow-key navigable.
- Toggle "Rated" (switch, label + ikon). Pilihan warna: radiogroup Putih/Hitam/Acak
  dengan swatch visual (bukan teks saja).
- Default terakhir dipakai disimpan per user (localStorage, hydration-gated).
- A11y: label eksplisit "Kontrol waktu"; ring fokus 2px kontras; tidak ada perubahan
  state yang hanya disinyalkan warna.

## 4. Game over modal (rematch/abort/draw)
- Urutan tombol: "Tanding Ulang" (primary), "Analisis" (secondary), "Tawari Remis"
  (hanya saat game masih hidup), "Menyerah" (destructive, konfirmasi 2-tahap: klik 1 →
  teks berubah "Yakin menyerah?" + ikon peringatan; klik 2 dalam 3 dtk eksekusi).
- Rematch: kirim challenge baru ke lawan dengan kontrol waktu sama; state tombol
  "Menunggu jawaban…" + spinner + aria-live; tolak/expire → pesan inline.
- Modal: focus trap, Escape menutup (kecuali game rated berjalan), kembalikan fokus ke
  papan setelah tutup.

## 5. Home: daftar tantangan (quick pairing lite)
- Section "Tantangan" di atas dashboard. Kartu: username lawan, kontrol waktu,
  rated/casual, warna, countdown ring (visual + `<span class="sr-only">kedaluwarsa dalam
  20 detik</span>`). Aksi Terima/Tolak besar (min 44px), keyboard reachable.
- Empty: "Belum ada tantangan. Undang teman atau main vs bot." + 2 CTA.
- Guest: lihat daftar tapi Terima memicu panel masuk (bukan memblokir lihat).

## 6. Puzzle unlimited: filter + stats
- Bar filter: dropdown tema (dari `/api/puzzles/themes`), rentang rating
  (2 slider atau preset: <1200/1200–1800/1800+), tombol "Terapkan" + "Reset".
- Panel stats (collapse di mobile): rating puzzle, streak (angka + ikon api),
  solved/fail hari ini. Semua angka sebagai teks berlabel.
- Setelah attempt: banner hasil inline di bawah papan (benar=hijau ✓ teks "Benar!",
  salah=merah ✕ teks + langkah terbaik) + aria-live polite; jangan auto-advance saat
  reduced-motion aktif; animasi board tetap transition transform pendek (<200ms).

## 7. Game review: akurasi & langkah kritis
- Di akhir review (atau panel samping): dua kartu akurasi persen (Putih/Hitam) + bar
  komposisi Inaccuracy/Mistake/Blunder dengan ikon berbeda + pola tekstur (bukan warna
  saja) untuk color-blind.
- Daftar langkah kritis: list tombol "12. Nxf7 — Blunder (delta -3.2)"; klik → lompat
  ke posisi; `aria-current="true"` pada langkah aktif.

## 8. Nav: mobile bottom-nav vs desktop sidebar
- Mobile: 5 slot tetap (Home, Bermain, Teka-Teki, Analisis, Komunitas) + sheet
  "Lainnya" (8 item: scan, vision, drills, bots, coach, leaderboard, friends, archive).
  Sheet: focus trap, Escape/overlay klik menutup, item aktif diberi aria-current +
  indikator titik di samping label. Tambahan item >8 → kelompokkan, jangan scroll.
- Desktop sidebar: 4 grup dengan `<h2 class="sr-only">` (Bermain / Latihan / Komunitas /
  Lainnya) + accordion Lainnya terbuka default. Item aktif: warna + indentasi bar 3px
  kiri (bukan warna saja).
- Semua item nav: `aria-label` label + konteks aktif; ukuran target ≥44px; skip-link
  "Lewati ke konten utama" di awal DOM menuju `#main-content`.

## 9. Standarisasi loading/error/empty
- Loading: skeleton (bukan spinner) untuk list; spinner kecil untuk aksi tombol
  (`aria-busy`). Teks sr-only deskriptif.
- Error: StateMessage error; retry mempertahankan scroll posisi; jangan duplikasi
  toast + inline.
- Empty: satu ilustrasi SVG buatan sendiri per konteks (papan kosong, kotak surat,
  trofi) — dibuat sendiri, bukan aset pihak ketiga.

## 10. prefers-reduced-motion & fokus
- Hook `useReducedMotion()` di `lib/`; dipakai confetti, animate-in, flybrain,
  clock-moves-fullscreen, promotion dialog.
- Fokus: token `--ring` 2px + offset 2px di SEMUA interaktif; uji tab order tiap view.
- Tidak ada feedback penting via audio saja; jika suara diputar, tampilkan juga banner/
  badge visual dan `aria-live` text yang setara.
