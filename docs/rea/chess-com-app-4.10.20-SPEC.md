# SPEC.md — Daily Puzzle Feature (chess.com Android 4.10.20)

> **Status: DRAFT — MENUNGGU PENINJAUAN (tahap E).** Tidak ada implementasi yang boleh dimulai sebelum spec ini direview.
> **Sumber:** analisis statis REA/jadx pada `chess-com-4.10.20-base.apk` (sha256 `d69ffbfb…e533`).
> **Disiplin:** Observation (dengan Evidence ID) / Inference (confidence + alternatif ditolak) / Unknown (tracked via `record_unknown`, ID `unk_*`).
> **Larangan:** spec ini adalah spesifikasi perilaku — bukan salinan kode. Semua nama kelas hanya sebagai referensi bukti, bukan untuk disalin.

## 1. Ruang Lingkup
Fitur: **Daily Puzzle** — satu teka-teki harian, pengambilan puzzle hari ini, submisi langkah, hint, statistik, dan daftar teman yang menyelesaikan.
Fitur lain (146 modul) belum dispesifikasi — lihat §7.

## 2. Observations (dengan Evidence ID)

### O1 — Entry point UI
`NewDailyPuzzleActivity.onCreate` memasang Compose content dan, bila `savedInstanceState == null`, memanggil refresh/start pada ViewModel via `p5().t()`. Error display di-wire via `ComposeErrorDisplayer.o(errorProcessor)`.
Evidence: `ev_1399bf6f…` (body metode onCreate lengkap).

### O2 — Dependency ViewModel
`NewDailyPuzzleViewModel` memegang (tipe teramati di metadata kelas): `NewDailyPuzzleRepository`, `features.puzzles.daily.net.a` (service), `GamesSettingsStore`, `SessionStore`, `featureflags.e`, `coach.w0`, `calendar.h`, `HintStage`, `ConcurrentHashMap<Long, g>` (state per-puzzle), beberapa `MutableStateFlow`.
Evidence: `ev_762b55d5…` (class summary, field types).

### O3 — Repository API surface
`NewDailyPuzzleRepository` menyediakan tepat 3 operasi:
- `b(LocalDate, cont) → f` — ambil puzzle untuk tanggal
- `a(LocalDate, LocalDate, cont) → List<c>` — ambil rentang (kalender)
- `c(long puzzleId, NewDailyPuzzleAction, HintStage, Integer, Integer, cont) → b` — submisi aksi + hint + dua counter opsional
Semua suspend. Repository mendelegasi 1:1 ke `features.puzzles.daily.net.e`.
Evidence: `ev_1a83c5cf…` (class summary).

### O4 — Network contract (nama method, bukan payload)
`NewDailyPuzzleServiceImpl` → `chesscom.puzzles.v2.TwirpRetrofitDailyPuzzleService` dengan 7 RPC: `GetDailyPuzzle`, `GetDailyPuzzleById`, `GetDailyPuzzlesByRange`, `GetDailyPuzzleUserStats`, `GetDailyPuzzleAttemptsByRange`, `ListFriendsWhoCompletedDailyPuzzle`, `SubmitDailyPuzzleAction`. Signature: `(Request, Map<String,String> headers, cont) → Response`.
Evidence: `ev_56cb6033…` (ServiceImpl), `ev_381d80d4…` (Retrofit interface, method list lengkap).

### O5 — Transport
Twirp over Retrofit/Wire JSON. Base URL literal `https://analysis.chess.com/twirp/` (dan staging variant) teramati di string pool. Auth via header `x-chesscom-*` (device-id, bucketing-id, play-client, ps-id, ref-id, utm-*) [REF string, classes8.dex].
Evidence: string-surface scan + `ev_381d80d4…`.

### O6 — Ketergantungan consent/flag (fitur terkait)
Analytics (AppsFlyer) hanya init bila `FeatureFlag.y3` dan consent `TrackingCategory.TARGETING` — pola flag-gating yang sama dipakai lintas fitur.
Evidence: `ev_37d4709e…` (initialize body), `ev_199ddec9…` (invokeSuspend consent collect).

### O7 — Persistence teramati (bukan pemetaan lengkap)
Schema Room memuat tabel `daily_puzzle_stats`, `tactics_*`, DB file `com.chess.features.puzzles.db` [REF schema strings]. Keterkaitan DAO→repository: Unknown (U1).

## 3. Inferences (interpretasi, confidence, alternatif ditolak)

- **I1 (high):** Submisi langkah dikirim via `SubmitDailyPuzzleAction` RPC dengan parameter `(puzzleId, action, hintState, int, int)`; dua Integer kemungkinan move count/elapsed, tapi **ini interpretasi nama-tipe, bukan terbukti** → lihat U2.
- **I2 (high):** Aliran data: Activity → ViewModel → Repository → ServiceImpl → TwirpRetrofit → HTTPS. Alternatif (langsung service dari Activity) ditolak: body onCreate hanya memanggil VM (`p5().t()`), tidak ada referensi service.
- **I3 (medium):** Server authoritative untuk validitas solusi; client melakukan validasi lokal untuk UX (board engine), tapi urutan/priority belum terbukti → U3.
- **I4 (medium):** Transport selalu TLS (cleartext diblokir default targetSdk 36, tanpa networkSecurityConfig cleartext) — inference dari manifest [OBS negatif] + konstanta URL https.

## 4. Kontrak Perilaku untuk Implementasi Independen

**Inputs:** tanggal (lokal), user session (headers), aksi pemain (move/hint), hint stage.
**Outputs (UI):** papan puzzle hari ini, status solved/failed, statistik personal, daftar teman selesai, kalender riwayat.
**State transitions (dari bukti struktur, belum lengkap):** idle → loading (t()) → playing → (hint stages) → submitted → result. Transition table lengkap = U3.
**Error paths (teramati di arsitektur):** error diproses via `errorProcessor` → `ComposeErrorDisplayer` (O1). Kontrak error spesifik per RPC = U2.
**Satuan/pembulatan:** waktu/counter yang dikirim ke SubmitDailyPuzzleAction tidak diketahui unitnya (ms/s/move-count) = U2.
**Format data:** JSON over Twirp (Wire), proto package `chesscom.puzzles.v2`; field-level shape = U2.

## 5. Residual Unknowns (audit: `audit_residual_unknowns` — semua open, terverifikasi)

| ID | Pertanyaan | Severity | Probe paling tepat |
|---|---|---|---|
| `unk_4f7083b3…968f3` | Payload shape & response contract `SubmitDailyPuzzleAction` (field semantics, error codes, retry/idempotency) | **high** | `inspect_android_method` pada Wire adapter `chesscom.puzzles.v2` (static) + controlled-replay ke test server sendiri (server-defined semantics) |
| `unk_6579629c…cb769de` | DAO mapping `daily_puzzle_stats`/`features.puzzles.db`; cache-first vs network-first | medium | `inspect_android_class` mapper return-type + DAO; runtime trace di emulator untuk ordering |
| `unk_409b3c3b…e41ddd8` | Validasi langkah client-side sebelum submit? penanganan server rejection? | medium | `inspect_android_method` pada VM move-handling & HintStage transitions |

## 6. Keterbatasan Analisis (Aturan 8)
- Semua bukti statis; tidak ada eksekusi APK.
- R8 obfuscation di level member — signature/tipe dipakai sebagai identitas, nama bisnis hanya di package & string.
- Split ABI (jika ada native) tidak dianalisis.
- Ketidakhadiran metode dalam coverage parsial ≠ tidak ada.
- Contract server (error codes, retry) tidak dapat dibuktikan dari APK saja.

## 7. Cakupan Fitur Lain
146 modul `com.chess.features.*` terinventarisasi (puzzles 840 kelas, versusbots 806, settings 595, dst). SPEC untuk fitur lain mengikuti pola yang sama per-fitur (workflow `investigate_feature` diulang per fitur). Entry points terpetakan di `rea-feature-trace-chess-com-4.10.20.md`.

## 8. Langkah Berikutnya (tahap E — STOP)
Analisis dihentikan di sini. **Jangan implementasi** sebelum:
1. Reviewer menyetujui spec ini
2. U2 (payload contract) dijawab — karena severity high dan memblokir implementasi submisi
3. Keputusan: implementasi independen hanya dari spec ini, bukan dari kode dekompilasi (Aturan 10)
