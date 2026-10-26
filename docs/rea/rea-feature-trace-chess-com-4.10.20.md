# REA Trace: Chess.com APK — Alur Fitur End-to-End (Coverage Parsial)

**Artefak:** `chess-com-4.10.20-base.apk` · sha256 `d69ffbfb…e533` · 57.929 kelas · 11 DEX
**Metode:** REA MCP (jadx-headless 0.7.1) — class summary + method body decompile + DEX string-surface scan.
**Diskiplin bukti:** `[OBS]` = teramati di body metode/bytecode terdekompilasi. `[REF]` = referensi string/metadata saja. **Tidak ada eksekusi runtime** — semua klaim jaringan adalah jalur kode, bukan traffic teramati.

---

## 0. JNI Boundary: TIDAK ADA di artefak ini [OBS negatif]

- `lib/` pada base APK **kosong** (0 file .so — diverifikasi zipfile pada kedua APK di cases).
- Scan DEX untuk `RegisterNatives`: **0 kecocokan**.
- Konteks `loadLibrary` di string pool hanya milik SDK (SoLoader/Facebook, React Native Metro, `SplitInstallHelper.loadLibrary` di pesan Play Core) — aplikasi sendiri tidak memanggil `System.loadLibrary` untuk modul chess-nya.
- Konsekuensi: engine catur/kalkulasi move adalah kode Kotlin/Java murni +/atau menunggu di split ABI (`requiredSplitTypes: base__abi,base__density` di manifest — split ABI diunduh Play Store, tidak ada di file ini).

## 1. Topologi Transport (berlaku untuk SEMUA fitur) [OBS]

Ditemukan tiga jalur keluar, semuanya dalam kode:

| Transport | Bukti kelas/URL |
|---|---|
| **Twirp/JSON over Retrofit (Wire)** | `https://analysis.chess.com/twirp/` + `https://analysis-staging.chess.com/twirp/` [OBS konstanta]; antarmuka `chesscom.*.v*.TwirpRetrofit*Service` (75 proto service teridentifikasi) |
| **WebSocket (Ktor)** | `wss://analysis.chess.com/v2/game-review`, `wss://analysis.chess.com/v1/legacy/game-analysis` [OBS konstanta] |
| **CometD/Bayeux long-polling (live games)** | `https://live2.chess.com/cometd` [OBS]; `org.cometd.client.BayeuxClient` dsb. di classpath |

Base host API chess.com dibangun dinamis (tidak tampak sebagai konstanta literal tunggal) — hanya path twirp `analysis.chess.com` yang literal.

## 2. Inventaris Fitur (146 modul `com.chess.features.*`) [OBS — jumlah kelas]

Besar (>250 kelas): puzzles 840, versusbots 806, settings 595, more 392, daily 363, paywall 332, analysis 385, activityfeed 370, connect 307, lessons 290, connectedboards 212, play 252, path 169, ads 160, train 161, live 111, chat 118.
Menengah: articles 147, membership 159, forums 107, messages 105, news 99, streak 90, vision 82, gamesetup 65, awards 62, leaderboard 55, guidedcoachgame 51, reactnativeapps 43, newgame 42, challenge 16, dsb.

## 3. Transport Backend per Fitur — Twirp Services teridentifikasi [OBS: kelas impl ada di APK]

| Fitur | Twirp service (paket proto) |
|---|---|
| Puzzles | `chesscom.puzzles.v2.DailyPuzzleService`, `chesscom.puzzles.v1.PuzzleService`, `chesscom.puzzle_path.v1.PuzzlePathGatewayService` |
| Play online | `chesscom.game_gateway.v2.GameGatewayService`, `chess.net.v1.games.LiveGamesServiceImpl`/`DailyGamesServiceImpl`, `chess.net.v1.playinvites.PlayInviteServiceImpl` |
| vs Bots | `chesscom.bots.v1.BotService`, `BotGroupService`, `CustomBotGameOverModalService`, `chess.features.versusbots.*ServiceImpl` |
| Analysis | `chess.net.v1.analysis.GameAnalysisServiceImpl`, `chess.features.analysis.standalonev2.net.AnalysisServiceImpl`, `chess.features.analysis.gamedetails.net.MasterPlayerSearchServiceImpl` |
| Lessons/Train | `chesscom.lessons.v1/v2.LessonService`, `chess.net.v1.lessons.LessonsService(V2)Impl`, `chesscom.train_gateway.v1.TrainGatewayService` |
| Membership/Paywall | `chesscom.payments.v1.GroupMembershipService`, `ProductService`, `chess.net.v1.membership.android.AndroidMembershipServiceImpl` (+ proto `com.chess.features.upgrade.v2.proto.billing`) |
| Activity feed | `chesscom.activity_feed.v1.ActivityFeedService` (21 ref), `ActivityFeedCommentsService`, `ActivityFeedPrivacyService` |
| Users/Profile | `chesscom.user_profile.v1.AccountService` (18 ref), `UserProfileService`, `SocialService`, `chess.net.v1.users.*` (Login/Profile/Config/FCM/AccountDeletion/ValidUsername/RefreshToken Impl) |
| Stats/Leaderboard | `chesscom.stats.v1.StatsService` (17 ref), `chess.net.v1.stats.StatsServiceImpl`, `chess.net.v1.leaderboard.LeaderboardServiceImpl` |
| Tournaments | `chesscom.tournaments.v1.TournamentService`, `TournamentStandingsService` |
| Notifikasi/Friends/Clubs/etc | `chesscom.notifications.v3.AlertsService`, `chesscom.friends_search.v2.FriendsSearchService`, `chesscom.clubs.v1.*`, `chesscom.deeplink.v2.DeeplinkService`, `chesscom.themes.v2.ThemesService`, `chesscom.configurator.v3/v4.ConfiguratorService`, + lainnya |

## 4. Trace Contoh #1 — Daily Puzzle (mendalam, semua hop [OBS])

```
UI Entry    : com.chess.features.puzzles.daily.NewDailyPuzzleActivity.onCreate(Bundle):void
              [OBS body] setContent → Compose s5(); if (savedInstanceState==null) p5().t()
              → VM method t() = refresh/start load
VM          : com.chess.features.puzzles.daily.NewDailyPuzzleViewModel
              [OBS field types] NewDailyPuzzleRepository, daily.net.a, GamesSettingsStore,
              SessionStore, featureflags.e, coach.w0, calendar.h, HintStage
Repository  : com.chess.features.puzzles.daily.newdailypuzzle.NewDailyPuzzleRepository
              [OBS fields/methods] dep: daily.net.e
              b(LocalDate, cont) → daily.newdailypuzzle.f  (fetch puzzle hari ini)
              c(long, NewDailyPuzzleAction, HintStage, Integer, Integer, cont) → b (submit move/hint)
Net Service : com.chess.features.puzzles.daily.net.NewDailyPuzzleServiceImpl
              [OBS field] chesscom.puzzles.v2.TwirpRetrofitDailyPuzzleService
              b(String,cont) → GetDailyPuzzleResponse
              a(long, DailyPuzzleAction, DailyPuzzleHintState, Int, Int, cont) → SubmitDailyPuzzleActionResponse
              c(String,String,cont) → GetDailyPuzzleAttemptsByRangeResponse
Retrofit IF : chesscom.puzzles.v2.TwirpRetrofitDailyPuzzleService
              [OBS methods] GetDailyPuzzle, GetDailyPuzzleById, GetDailyPuzzlesByRange,
              GetDailyPuzzleUserStats, GetDailyPuzzleAttemptsByRange,
              ListFriendsWhoCompletedDailyPuzzle, SubmitDailyPuzzleAction
              (masing-masing: (Request, Map<String,String> headers, cont) → Response)
Network     : Retrofit + Wire JSON → https://analysis.chess.com/twirp/chesscom.puzzles.v2.DailyPuzzleService/<Method>
              [REF] base URL literal teramati; service path dari paket proto (konvensi Twirp) —
              path final dibentuk runtime oleh WireTwirpRetrofit runtime, bukan string literal
Local effect: [REF] DB `com.chess.features.puzzles.db`, tabel Room `daily_puzzle_stats`,
              `tactics_*` — puzzle submit meng-update stats cache (tabel teramati di schema
              string; pemetaan DAO→panggilan persist belum didekompilasi per-baris)
```

## 5. Trace Contoh #2 — AppsFlyer (analytics event, dari sesi sebelumnya) [OBS]

`initialize()` [flag `FeatureFlag.y3`] → coroutine `trackingConsent.a(TARGETING)` collect → configure `AppsFlyerLib` → `d(productId,isFreeTrial)` emit `b.Purchase` → event flow `l58<b>` → AppsFlyer SDK internal (`com.appsflyer.internal.AFa1*`) → HTTP (host dibentuk format-string `%sadrevenue.%s` [REF]).
**Final effect:** network call ke AppsFlyer; tidak ada tulisan DB di wrapper; off-buffer milik SDK.

## 6. Trace Contoh #3 — Streak widget [OBS sebagian]

Manifest [OBS]: `com.chess.widgets.streak.{Small,Large}StreakWidgetReceiver` (exported).
Kode [REF]: `com.chess.features.streak.StreakService` (twirp) + DB `play_streak` (Room, schema teramati).
UI entry adalah Glance AppWidget (`androidx.glance.appwidget.GlanceRemoteViewsService` exported [OBS]). Rantai per-hop widget→service belum didekompilasi (sisa coverage).

## 7. Database Lokal (Room) — 136 tabel teramati di schema strings [OBS]

Kelompok: gameplay (`live_games`, `daily_games`, `bot_games`, `coach_games`, `conditional_properties`, `game_variations`, `top_games`), tactics/puzzles (`tactics_problem`, `tactics_solution`, `tactics_rush_*`, `daily_puzzle_stats`, `puzzle_path_*`, `endgame_*`, `practice_*`), lessons (`lessons`, `lesson_courses`, `lesson_questions`), sosial (`users`, `friends`, `messages`, `conversations`, `notifications`, `forums_categories`), konten (`articles*`, `news*`, `videos*`, `today_*`, `tv_schedule_event`), theming (`theming_*`, `user_theme_join`), telemetri SDK (`events`, `events_snapshot`, `offline_buffered_pings`, `vision_scores`, `queue`, `upload_queue`, `play_game_client_metrics`).
DB files: `com.chess.db`, `com.chess.features.{puzzles,path,profile}.db`, `gameSettingsStore.db`, `streakStore.db`, dll [REF — nama].

## 8. Sisa Coverage (belum didekompilasi per-hop)

- Rantai widget→VM→service untuk 6 widget receiver (§6).
- Pemetaan DAO konkret ke tabel untuk tiap fitur (hanya 3 fitur ditelusuri sampai network effect).
- Login/session: `com.chess.net.v1.users.LoginServiceImpl`, `SessionSyncService.fullUpdate` teridentifikasi [OBS nama-nama metode inner] tapi body belum didekompilasi.
- vs Bots engine: modul 806 kelas; engine move generation lokal (tidak ada JNI — murni Kotlin; perlu trace terpisah).
- Offset instrumen-level (DEX code-unit offset per invoke) tidak ditampilkan: REA evidence mengembalikan body decompiled + `def_pos` (0 untuk semua — metode utama), offset mentah tersedia di evidence ID masing-masing panggilan (`ev_*` di log REA).

## 9. Metodologi & Batasan
- Semua call-chain dibaca dari body dekompilasi (jadx) — call graph statis, tidak termasuk refleksi/dinamik.
- Tidak ada eksekusi APK; "network call" = jalur kode yang menunjuk endpoint, bukan observasi traffic.
- Fitur yang dicover end-to-end penuh: Daily Puzzle, AppsFlyer analytics. Fitur lain: entry point + transport layer teridentifikasi, kedalaman per-hop parsial.
