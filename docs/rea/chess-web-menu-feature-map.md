# Chess-Web — Peta Menu & Fitur Lengkap (Tiruan chess.com)

**Tanggal:** 2026-10-22 · **Metode:** Runtime authenticated — hover-expand semua grup sidebar (50 item menu) + crawl 28 halaman tujuan + 3 batch UI/UX sebelumnya.
**Sumber:** `menu-tree.json`, `menu-pages-capture.json`, `ui-capture*.json`.

---

## A. Peta Menu Sidebar (7 grup, 50 item — copy asli id_ID)

### 1. Bermain
| Menu | Route | Fitur inti |
|---|---|---|
| Main Online | `/play/online` | pairing quick + custom + teman + tabs [Baru\|Permainan\|Pemain] |
| Lawan Bot | `/play/computer` | bot picker + 14 preset waktu + undo/opsi |
| Lawan Pelatih | `/play/coach` | bot dengan mode **Casual / Seimbang / Challenging** — game berfungsi mengajar (komentar coach) |
| Statistik | `/stats` → `/member/<u>/stats` | dashboard statistik + filter "90 hari", gate premium "Dapatkan Statistik Lanjutan" |
| Turnamen-turnamen | `/play/online/tournaments` | arena live list |
| Varian | `/variants` | 4-player & variants, tabs [Home\|Lobby\|Arenas\|Watch\|Leaders\|Archive\|Friends], search by rules |
| Riwayat Permainan | `/games/archive` | filter [Semua\|Favorit\|Langsung\|Harian\|Bot\|Pelatih] + bulk analyze/download |

### 2. Teka-Teki
| Menu | Route | Fitur |
|---|---|---|
| Tidak Terbatas | `/puzzles` | puzzle rating-based, streak, hint |
| Teka-Teki Harian | `/daily` | puzzle tanggal navigasi **[← Hari Sebelumnya \| 22 Okt 2026 \| Hari Berikutnya →]** + Petunjuk + Audio coach + Bagikan |
| Teka-Teki Gegas | `/puzzles/rush` | survival: 3/5 mnt/endless, 3 strike |
| Duel Teka-Teki | `/puzzles/battle` | 1v1 realtime: tabs [Bermain\|Tonton\|Papan Peringkat], cari lawan by username, rating tampil (mis. "wsningrat (1674)") |
| Teka-Teki Kustom | `/puzzles/learning` | 26 tema dengan progress % per tema (Back Rank Mate 100%, Garpu 50%…), filter select + number inputs |

### 3. Belajar
| Menu | Route | Fitur |
|---|---|---|
| Tidak Terbatas | `/learn` | path belajar: kategori "Pemula"→"Pembukaan tingkat lanjut", CTA "Pelajaran Berikutnya" |
| Bermain vs. Pelatih | `/play/coach` | (sama dgn menu Bermain) |
| Pembukaan | `/lessons/learn-the-openings` | katalog pelajaran: video + Tantangan + Kemahiran (3 mode belajar), search, bookmark |

### 4. Berlatih
| Menu | Route | Fitur |
|---|---|---|
| Kursus | `/courses` | kursus terstruktur ("Knights vs. Bishops", "Your First 10 Checkmates"), path `/courses/train/<uuid>` |
| Analisis | `/analysis` | 6 pintu masuk + paste PGN/FEN fast path |
| Tinjauan | `/insights` | analisis tren pemain: filter rating-type, kategori waktu, tampilan [Semua\|Warna\|Buah\|Pemain\|Performa Lampau] — deep-link `/insights/hikaru` (publik) |
| Ruang Kelas | `/classroom` | join by room ID + "Ruangan Baru", board collab |
| Permainan Akhir | `/endgames` | drill per tema (Skatmat, Bidak, Perwira, Benteng, Menteri, Ketimpangan) + leaderboard |
| Latihan | `/practice` | drill terstruktur |
| Aimchess | eksternal | (partner link — skip untuk porting) |

### 5. Tonton
| Menu | Route | Fitur |
|---|---|---|
| Ajang | `/events` | tabs [Terkini\|Akan Datang\|Terdahulu] + format chips [Klasik\|Cepat\|Kilat], event cards (Titled Tuesday, Bullet Brawl…) |
| ChessTV | `/tv` | jadwal siaran locale-aware + share ke 7 platform |
| Penyiar | `/streamers` | direktori streamer |
| Sedang Bermain | `/play/online/watch` | spectate live games: filter tipe, search username |

### 6. Komunitas
| Menu | Route | Fitur |
|---|---|---|
| Teman | `/friends` | invite via link/email/tantangan-link, tabs Masuk(0)\|Keluar(2), per-teman: [Kirim Pesan\|Tampilkan opsi\|Tantangan→/play/online/new?opponent=X] |
| Klub | `/clubs` | klub Anda + "Klub-klub di Dekat Anda" (geosearch), join, member count |
| Anggota | `/members` | direktori |
| Pelatih | `/coaches` | marketplace pelatih |
| Pemain Papan Atas | `/players` | titled players |
| Chess Ratings | `/ratings` | leaderboard resmi: filter [Langsung\|Resmi], [Semua\|Wanita\|Junior], negara, include-inactive, kolom rating Klasik/Cepat/Kilat + Usia |
| Papan Peringkat | `/leaderboard` | global per tipe partai |
| Chess Today | `/today` | digest harian: articles/blogs/lessons/news/videos |
| Berita / Artikel / Blog / Forum | `/news` `/articles` `/blogs` `/forum` | konten editorial + diskusi (search, pagination, mark-read) |

### 7. Lainnya
| Menu | Route | Fitur |
|---|---|---|
| Koleksi | `/analysis/collections` | simpanan analisis/PGN |
| Database Permainan | `/games` | master DB search |
| Istilah-istilah Catur | `/terms` | glossary A–Z (Alekhine Gun…) |
| Aturan | `/learn-how-to-play-chess` | rules interaktif |
| Penjelajah | `/explorer` | opening explorer: move tree + win-rate per posisi, sumber "Semua Chess.com Game", cross-link kursus per opening |
| Catur Voting | `/votechess` | komunitas vote langkah game bersama |
| Catur Tunggal | `/solo-chess` | puzzle mekanik: "Pukul buah setiap melangkah hingga tersisa satu", kontrol [Coba Lagi\|Batalkan Langkah\|Ulangi] |
| Kejuaraan Komputer | `/computer-chess-championship` | konten event |
| Peranti | `/resources` | katalog alat eksternal (ChessKid, Chess Clock app…) |
| Visi | `/vision` | drill koordinat: select papan/waktu + checkbox "blind mode" |
| Hadiahkan / Shop | eksternal | commerce — skip |

## B. Akun (bukan sidebar, tapi bagian fitur)
`/settings/board` (papan & bidak), profil tabs [Ikhtisar|Permainan|Statistik|Teman|Penghargaan|Klub], `/messages` inbox, `/membership` (paywall 3-tier), alert center (`/callback/alert/alerts`: games/messages/game_seek).

## C. Prioritas Porting chess-web (rekomendasi)

**P0 — MVP playable (13 fitur):**
1. Play online (pairing + challenges inline)
2. Play vs bot (Stockfish)
3. Board settings (`/settings/board`)
4. Game archive (filter + analyze/download)
5. Analysis board (paste PGN/FEN)
6. Puzzles unlimited (rating-based)
7. Daily puzzle (navigasi tanggal)
8. Puzzle Rush (3 strike)
9. Profil + stats dasar
10. Friends + challenges
11. Leaderboard
12. Toasts + realtime badge nav
13. Auth + profil status

**P1 — Engagement layer (9 fitur):**
14. Puzzle Battle 1v1 · 15. Puzzle Custom (tema+progress) · 16. Learn path + lessons interaktif · 17. Courses · 18. Endgame drills · 19. Vision drill (koordinat + blind mode) · 20. Solo Chess · 21. Insights (tren pemain) · 22. Clubs

**P2 — Konten & sosial:**
23. Tournaments/Arena · 24. Spectate live · 25. ChessTV jadwal · 26. Events · 27. News/Articles/Blog · 28. Forum · 29. Terms glossary · 30. Rules interaktif · 31. Opening Explorer · 32. Classroom (room ID collab) · 33. Coach marketplace · 34. Ratings resmi multi-filter · 35. Vote Chess · 36. Messages inbox

**P3 / Skip:** Variants 4-player, Kejuaraan Komputer, Aimchess/Shop/ChessKid, ads/paywall (atau ganti model sendiri).

## D. Signature UX yang wajib ditiru
1. **3 kartu task harian** di home (puzzle/lesson/review) — engagement loop.
2. **Inline challenge dual-button** di semua permukaan (home/online/profil/friends).
3. **End-game → auto Game Review** dengan coach audio toggle.
4. **Paste PGN/FEN fast path** di analysis.
5. **Progress % per tema** (puzzle custom, endgames) — motivator mastery.
6. **Deep-link publik per pemain** (`/insights/hikaru`, `/member/x/stats`) — SEO + share.
7. Time-control sebagai **chip preset**, bukan dropdown.
8. **Realtime badge nav** ("Bermain 3") — pubsub-driven.
9. Skip-link + aria-label (a11y floor).
10. Semua animasi bidak via satu CSS var `--move-animation-duration`.
