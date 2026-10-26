# Laporan Analisis Statis APK Chess.com (REA / jadx-headless)

**Artefak:** `chess-com-4.10.20-base.apk` (base split Google Play, tanpa native libs/split ABI)
**SHA-256:** `d69ffbfb6b3056539370fb706237e850ad996c51bc9a85b3485c7c8caa41e533`
**Versi:** 4.10.20-googleplay (versionCode 280085), minSdk 28, targetSdk 36
**Paket:** `com.chess` · Main activity: `com.chess.splash.SplashActivity`
**Engine:** jadx-headless-mcp 0.7.1 · 57.929 kelas, 9.021 resource, 11 DEX
**Metode:** manifest parse (androguard) + string-surface scan DEX + decompile terpilih via REA MCP (jadx)

> Disiplin klaim: **[REF]** = ada di string/kode/metadata, bukan bukti akses runtime.
> **[OBS]** = perilaku yang teramati dari body metode yang didekompilasi (masih statis — APK tidak dieksekusi).

---

## 1. Izin yang Dideklarasikan (30, dari AndroidManifest)

| Kelompok | Izin |
|---|---|
| Lokasi | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` |
| Personal | `READ_CONTACTS` |
| Jaringan | `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` |
| Background/notif | `FOREGROUND_SERVICE`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `SCHEDULE_EXACT_ALARM`, `VIBRATE` |
| Media/penyimpanan | `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` |
| Biometrik | `USE_BIOMETRIC`, `USE_FINGERPRINT` |
| Bluetooth | `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` |
| Anti-cheat/integritas | `DETECT_SCREEN_CAPTURE` |
| Billing/ads | `com.android.vending.BILLING`, `com.google.android.c2dm.RECEIVE`, `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`, `com.google.android.gms.permission.AD_ID`, `ACCESS_ADSERVICES_AD_ID/ATTRIBUTION/TOPICS` |
| Lain | `com.amazon.privacypass.ATTEST`, `com.chess.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` |

Izin sensitif yang menonjol: `READ_CONTACTS` (temukan teman), lokasi presisi (GDPR/regional compliance iklan), `DETECT_SCREEN_CAPTURE` (anti-kebocoran game).

## 2. Komponen yang Diekspor

**Activities (6):**
- `com.chess.splash.SplashActivity` (launcher)
- `com.chess.home.HomeActivity`
- `com.facebook.CustomTabActivity` [REF]
- `org.prebid.mobile.rendering.views.browser.AdBrowserActivity` [REF — SDK iklan]
- `com.amazon.aps.ads.activity.ApsInterstitialActivity`, `com.amazon.device.ads.DTBInterstitialActivity` [REF — Amazon Ads]

**Services (3):** `com.google.android.gms.auth.api.signin.RevocationBoundService`, `androidx.glance.appwidget.GlanceRemoteViewsService`, `androidx.work.impl.background.systemjob.SystemJobService`

**Receivers (10):** 6 widget receiver `com.chess.widgets.{play,streak,daily}.{Small,Large}*WidgetReceiver`, `com.chess.utils.android.phonenumbers.SmsCodeBroadcastReceiver` (OTP SMS), `com.google.firebase.iid.FirebaseInstanceIdReceiver`, `androidx.work.impl.diagnostics.DiagnosticsReceiver`, `androidx.profileinstaller.ProfileInstallReceiver`

**ContentProviders (12, semua `exported=false`):** FileProvider (`com.chess`, `com.chess.fileprovider`), Intercom ×2, MobileAdsInitProvider, FacebookInitProvider, VungleProvider, FirebaseInitProvider, PicassoProvider, dll. Tidak ada provider yang terekspos ke app lain.

## 3. SDK Analitik/Pelacakan (kelas teramati di classpath — kelas ada, bukan bukti runtime-active)

| SDK | Bukti kelas [OBS ada di APK] | Entri manifest [REF] |
|---|---|---|
| AppsFlyer (attribusi) | `com.appsflyer.*` (100+ kelas) + wrapper `com.chess.features.appsflyer.impl.AppsFlyerManager` | — |
| Firebase | `com.google.firebase.*`, `FirebaseInstanceIdReceiver`, FirebaseInitProvider | — |
| Crashlytics | marker `com.google.firebase.crashlytics` + URL `firebase-settings.crashlytics.com/spi/v2/...` [REF] | — |
| Google Analytics | DB string `google_app_measurement.db`, URL `app-measurement.com/a` [REF] | — |
| Facebook | `com.facebook.*` (CustomTab, AccessTokenManager prefs), FacebookInitProvider | queries `com.facebook.katana` |
| Intercom (support chat) | `io.intercom.android.sdk.*` + 2 provider | — |
| Iklan: AdMob/GMS Ads, Amazon DTB/APS, Vungle, Prebid, AppLovin | kelas + activity interstitial masing-masing | meta adservices |
| AppsFlyer internal network | `com.appsflyer.internal.*` obfuscated | — |

Tidak ditemukan marker: Braze, Mixpanel, Adjust, Branch, Unity Ads, IronSource (tidak ada di string pool DEX).

## 4. Domain yang Ditemukan (string pool DEX — semuanya [REF] kecuali disebut lain)

**Domain first-party (referensi konfigurasi/aset):**
- `chess.com`, `www.chess.com`, `chess.net` (API/marketing), `chesscomfiles.com`, `images.chesscomfiles.com` (196× — CDN gambar/flair), `assets-coaches.chess.com`, `assets-configurator.chess.com`

**Domain pihak ketiga berdasarkan kelas SDK pemiliknya (masih [REF], kelasnya nyata ada):**
- Google/GMS: `googleapis.com` (2189×, sebagian besar string internal library), `firebaseremoteconfig.googleapis.com/v1/projects/%s...` [REF format string], `firebase-settings.crashlytics.com` [REF], `app-measurement.com` [REF], `googleads.g.doubleclick.net`, `pagead2.googlesyndication.com` [REF]
- Ads: `adx.ads.vungle.com`, `logs.ads.vungle.com`, `supply.inmobicdn.net`
- Support/attribution: `intercom.com`, `js.intercomcdn.com`, `mobile-data.onetrust.io` (consent CMP), AppsFlyer template `%sadrevenue.%s` [REF format]
- Developer/docs (bukan endpoint runtime): `github.com`, `developer.android.com`, `square.github.io`, dll — dikeluarkan dari daftar endpoint.

**Kendala metodologis:** banyak host dibentuk runtime lewat format string (`graph.%s`, `%sadrevenue.%s`, host API chess.com kemungkinan besar juga dikonstruksi). Static scan hanya menemukan fragmen. Konfirmasi akses aktual memerlukan trace runtime (Frida/PCAP) — tidak dilakukan di analisis ini.

## 5. Mekanisme Penyimpanan Lokal

**Database SQLite (nama file teramati di DEX string — [REF] nama; kelas model Room teramati [OBS]):**
- `com.chess.db` — Room DB utama; kelas model `com.chess.db.model.stats.GraphPeriod`, `com.chess.db.model.endgame.EndgameDrillDbModel` teramati di string DEX kelas 6/7 [OBS referensi kelas]
- `com.chess.features.puzzles.db`, `com.chess.features.path.db`, `com.chess.features.profile.db`
- `gameSettingsStore.db`, `gameplayLiveSettingsStore.db`, `gamesCount.db`, `streakStore.db`, `membershipSnapshotStore.db`, `opmStore.db`, `share_target_ranking_store.db` — [REF]
- SDK: `google_app_measurement.db`, `google_app_measurement_local.db`, `exoplayer_internal.db`, `AdMobOfflineBufferedPings.db`, `OfflineUpload.db`, `com.im_11.3.0.db` (Intercom), `com.google.android.gms.ads.db`

**DataStore Preferences (Jetpack):** `androidx.datastore.preferences` + spesifik app:
- `com.chess.themes.DataStoreThemePreferences` [OBS — kelas terdekompilasi: field `com.google.android.ym2<uk9>` yaitu `DataStore<Preferences>`, serializer Moshi untuk `CurrentTheme`, field `SessionStore`]
- `com.chess.skills.DataStoreSkillsPreferences`, `DataStoreSkillsPreferences`, bot/coach/gameplay: `BotSetupPreferences`, `CoachPreferences`, `GameplayAnimationPreferences`, `GameReviewPreferences`, `boardPreferences`, dll — [REF nama]

**SharedPreferences:** `com.facebook.AccessTokenManager.SharedPreferences`, `com.facebook.AuthenticationTokenManager.SharedPreferences`, `com.facebook.internal.preferences` [REF — milik FB SDK]

**File-based:** FileProvider authorities `com.chess` & `com.chess.fileprovider` [REF] untuk share/cache gambar.

## 6. Hasil Decompile Terpilih (AppsFlyer integration) — [OBS]

**`com.chess.features.appsflyer.impl.AppsFlyerManager`** (wrapper app di atas SDK `com.appsflyer.AppsFlyerLib`):
- Field: `Context`, `com.chess.featureflags.e`, `com.chess.analytics.api.b`, `com.chess.trackingconsent.b` (consent manager), `CoroutineContextProvider`, `AtomicReference<Uri>`, Flow `g: l58<AppsFlyerManager$b>` (event flow), `String j` (logger tag)
- **`initialize()`** [OBS — body]:
  ```java
  public void initialize() {
      if (this.featureFlags.a(FeatureFlag.y3)) {
          // launch coroutine di ProcessLifecycleOwner (app foreground)
      }
  }
  ```
  → SDK AppsFlyer HANYA diinisialisasi bila feature flag `FeatureFlag.y3` aktif, dan dieksekusi saat app masuk foreground.
- **Coroutines dalam `initialize` (inner class `$initialize$2$1$1/2/3`) [OBS]:**
  - `$2$1$1.invokeSuspend`: collect `trackingConsent.a(TrackingCategory.TARGETING)` → mempengaruhi konfigurasi AppsFlyerLib berdasarkan consent iklan (pasangan `AppsFlyerConsent` ada di classpath).
  - `$2$1$2.invokeSuspend`: collect `bucketingId.b(): Flow<String>` → set user ID eksperimen/bucketing ke AppsFlyer.
  - `$2$1$3.invokeSuspend`: `flatMapLatest` atas `featureFlags.d(FeatureFlag.z3)` → konfigurasi dinamis via remote flag.
- **`d(String productId, boolean isFreeTrial)` [OBS]:** emit event `b.Purchase` ke `eventsFlow` → event pembelian dilaporkan ke AppsFlyer (InAppPurchaseValidatorListener ada di classpath).
- **`onConversionDataSuccess(Map)` [OBS]:** hanya `log` — conversion data TIDAK di-cache/dikirim ke mana pun oleh wrapper.
- **`onAppOpenAttribution`, `onAttributionFailure`, `onConversionDataFail`, `onDeepLinking`** — implementasi listener interface AppsFlyer.
- **`a()` [OBS]:** `this.eventsFlow.g(b.C0371b.a)` — emit event launch; **`b(String)`**: emit event berparameter.

## 7. Ringkasan Kepatuhan/Privasi

- Consent pipeline eksplisit: `com.chess.trackingconsent.b` + `TrackingCategory.TARGETING` + OneTrust (`mobile-data.onetrust.io`) — init iklan/attribution digate oleh consent & feature flags.
- `ACCESS_ADSERVICES_*` (Privacy Sandbox) dideklarasikan — konsisten dengan AdMob.
- `READ_CONTACTS`, lokasi presisi — permintaan runtime, bukan otomatis (perlu verifikasi dinamis untuk memastikan).

## 8. Batasan Analisis
- Statis murni — tidak ada eksekusi, tidak ada capture jaringan; semua klaim domain adalah referensi string, bukan traffic teramati.
- Banyak nama metode/kelas obfuscated (alias satu huruf); identifikasi via tipe & konteks.
- APK base split — native libs & split ABI tidak dianalisis.
- Signature APK tidak diverifikasi.
