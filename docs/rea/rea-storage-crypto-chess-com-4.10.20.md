# REA: Penyimpanan Data & Kriptografi — chess-com-4.10.20-base.apk

sha256 `d69ffbfb…e533` · REA/jadx 0.7.1 · statis, tanpa eksekusi.
Bukti: `[OBS]` = body/konstanta terdekompilasi · `[REF]` = referensi string/metadata.

---

## 1. Mekanisme Penyimpanan `<data>`

### 1.1 SharedPreferences
- Facebook SDK: `com.facebook.AccessTokenManager.SharedPreferences`, `com.facebook.AuthenticationTokenManager.SharedPreferences`, `com.facebook.internal.preferences` [REF nama file prefs]
- AppsFlyer: sharedpref `appsflyer-data` — eksplisit di `res/xml/backup_rules.xml` & `data_extraction_rules.xml` [OBS XML terdekompilasi]
- Consent IAB: string prefs `IABTCF_TCString`, `gad_has_consent_for_cookies`, `IABUSPrivacy_String`, `UPTC_UptcString` [REF — milik CMP/ads]
- Tidak ada `EncryptedSharedPreferences` / `androidx.security.crypto` di APK [OBS negatif]

### 1.2 SQLite (Room) — TIDAK terenkripsi
- 136 tabel Room teramati (CREATE TABLE IF NOT EXISTS strings) — gameplay (`live_games`, `daily_games`, `bot_games`, `conditional_properties`), tactics (`tactics_problem`, `tactics_solution`, `tactics_rush_*`), lessons, sosial (`users`, `friends`, `messages`, `conversations`), theming, telemetri (`events`, `offline_buffered_pings`, `upload_queue`) [OBS]
- **SQLCipher: 0 kecocokan** [OBS negatif] → DB plaintext di `databases/`
- Pengecualian backup TIDAK mencakup DB: `fullBackupContent`/`dataExtractionRules` hanya exclude datastore/themes/appsflyer-prefs [OBS XML] → **Room DB ikut cloud-backup & device-transfer**

### 1.3 DataStore (Preferences + Proto)
- `com.chess.themes.DataStoreThemePreferences` [OBS — DataStore<Preferences> + Moshi]; skills/bot/coach/gameplay stores [REF nama]
- Proto datastore: `com.chess.passandplay.proto.datastore`, `playpingstats.proto` [REF]
- Backup: `datastore/user_support_store.preferences_pb` & `intercom_user_prefs_datastore.preferences_pb` di-exclude dari cloud backup & device-transfer [OBS XML]; datastore lain TIDAK di-exclude.

### 1.4 Files
- FileProvider authorities `com.chess`, `com.chess.fileprovider` (exported=false) [OBS manifest]
- Backup-excluded: `themes/`, `downloadable_assets/` [OBS XML]
- `allowBackup="true"` + `dataExtractionRules` [OBS manifest]

### 1.5 Keystore
- `AndroidKeyStore` + `KeyGenParameterSpec$Builder` dipakai — pemilik terverifikasi: **Intercom SDK** [OBS kelas]
- `io.intercom.android.sdk.utilities.CryptoHelper` [OBS]:
  - fields: `ANDROID_KEYSTORE`, `TRANSFORMATION`, `GCM_IV_LENGTH`, `GCM_TAG_LENGTH`, `KEY_ALIAS`
  - inner `AndroidKeystoreKeyProvider` (`getOrCreateKey()`) — key di-generate di hardware keystore, tidak hardcode
  - `encrypt$intercom_sdk_base_release(String)` [OBS body]: `Cipher.getInstance(TRANSFORMATION)` (GCM), `cipher.init(ENCRYPT_MODE, key)`, IV dari `cipher.getIV()` di-prepend ke ciphertext (`f.I(iv, bArr)`) lalu Base64. IV acak per enkripsi — benar.
  - `decrypt$intercom_sdk_base_release` — kebalikannya.
- Endpoint app (`x-chesscom-*` auth headers, `x-authentication-expires` [REF classes8]) — token auth disimpan via `SessionStore` [OBS field types di VM/Store impls]; mekanisme persistensi token (DataStore vs prefs) belum didekompilasi per-hop.

## 2. Kriptografi Embedded — temuan & false positive

| Temuan | Verdict | Bukti |
|---|---|---|
| Hex 64-char `8efcf51b…da1c` (muncul di SEMUA 11 DEX) | **BUKAN key** — ini `pg-map-id` R8 (ProGuard mapping id) di footer string tiap DEX: `~~R8{"backend":"dex",…,"pg-map-id":"8efcf51b…"}` [OBS context] | false positive terverifikasi |
| `AES/GCM/NoPadding` | Intercom CryptoHelper [OBS — kelas terdekompilasi] + 1 use lain di classes2 (ad-SDK region) | keystore-backed |
| `AES/ECB/PKCS7Padding` | classes2.dex, konteks string ad-SDK (`AD_*` constants) [REF] — bukan modul chess.com | ECB = mode lemah; milik SDK iklan |
| `AES/CBC/PKCS5/7Padding` | classes4.dex dekat `AESSettingsCipherMode` [REF] (WorkManager/AndroidX crypto region) + CBC/PKCS5 di classes11 | CBC + static IV risk perlu cek runtime; bukan jalur data utama |
| `AES/CTR/NoPadding`, `IvParameterSpec`, `SecretKeySpec` | javax.crypto umum (Tink/BouncyCastle-ish internals + SDK) [REF] | — |
| Tink (`com.google.crypto.tink`) | marker ada [REF]; pemakaian konkret tidak didekompilasi | — |
| PBKDF2 / RSA cipher / MD5-sha1 usage app | tidak ada PBKDF2/RSA-cipher string; MD5/SHA-1 hanya di library legacy strings [REF] | — |
| Hardcoded IV | tidak ditemukan IV literal di string pool; IV Intercom dinamis [OBS] | — |

Kesimpulan: **tidak ada hardcoded crypto key milik app** yang teramati. Kriptografi at-rest yang benar-benar terverifikasi hanya Intercom (Keystore+GCM). Token/creds app-level bergantung keystore OS tidak terbukti.

## 3. Encryption at Rest?

- **DB Room: TIDAK terenkripsi** [OBS negatif SQLCipher]. Chess history, pesan, profil, stats tersimpan plaintext.
- **SharedPreferences/DataStore: plaintext** kecuali nilai yang dienkripsi Intercom SDK-nya sendiri.
- **Keystore**: hanya Intercom yang terbukti memakai; app sendiri tidak menunjukkan wrapper keystore sendiri (tidak ada kelas `com.chess.*crypto*` / `*keystore*` — hanya `features.settings.extrasecurity` yang adalah fitur 2FA/keamanan-akun, bukan storage crypto) [OBS negatif di hasil search "security/crypt"].
- `allowBackup=true` tanpa exclude DB → data plaintext ikut backup cloud [OBS XML].

## 4. Encryption in Transit?

- Semua endpoint teramati `https://` / `wss://` (`analysis.chess.com/twirp/`, `live2.chess.com/cometd`, `wss://analysis.chess.com/v2/game-review`, `text-and-audio.chess.com`) [OBS konstanta]
- `usesCleartextTraffic`: **tidak ada di manifest** [OBS negatif] → default targetSdk 36 = cleartext HTTP diblokir.
- Tidak ada `networkSecurityConfig` kustom di manifest [OBS negatif].
- **Certificate pinning: tidak ditemukan** — tidak ada string `SSLPinning`/konfigurasi pin; `certificatePinner` hanya field internal OkHttp [REF]. (Pinning via split/module lain tidak teramati.)
- Header auth: `x-chesscom-*` (device-id, bucketing-id, play-client, utm) [REF] — kredensial via header TLS, bukan URL.

**Kesimpulan transit**: TLS di semua jalur [OBS konstanta + policy default] — TAPI tanpa pinning → MITM dengan CA ter-instal (proxy/debug CA di device user) bisa memintersep semua trafik & token.

## 5. Risiko Konkret (per severity)

1. **[Tinggi] DB plaintext + ikut cloud backup**: pesan (`messages`, `conversations`), history game, data profil tersimpan plaintext DAN tidak di-exclude dari `cloud-backup`/`device-transfer` → dump via adb backup/gdrive restore, atau akses device-transfer. (vs datastore sensitif yang di-exclude dengan benar — inkonsistensi.)
2. **[Tinggi] Tanpa certificate pinning**: token auth (`x-chesscom-*`) dan data akun rentan MITM oleh CA user-installed; combined dengan ads SDK banyak (AdMob/Vungle/Amazon/Prebid/AppLovin) → surface proxy/man-in-the-middle besar.
3. **[Sedang] ECB & CBC muncul di SDK pihak ketiga** (ECB/PKCS7 di ad-SDK region) — mode lemah dalam SDK; dampak terbatas ke data SDK, bukan data akun, tapi layak dicatat.
4. **[Sedang] Token persistensi tidak terverifikasi terenkripsi**: `SessionStore` dipakai lintas fitur; tidak ada bukti wrapping keystore milik app → token mungkin plaintext di DataStore/prefs (perlu konfirmasi runtime).
5. **[Rendah] `allowBackup=true`** — mempermudah ekstraksi data app di device rooted/debuggable walau user biasa tidak terdampak.
6. **[Rendah] READ_CONTACTS + plaintext storage** — kontak yang di-sync (`contacts.v1.ContactsService` [REF]) jika ter-cache di DB plaintext ikut risiko #1.
7. **[Positif] Yang dilakukan benar**: cleartext diblokir default targetSdk 36; IV dinamis per-encrypt (Intercom); keystore hardware untuk Intercom; eksklusi backup untuk datastore sensitif; consent gating analytics (TARGETING category) sebelum init tracking.

## 6. Batasan
- Statis: "tidak ditemukan" ≠ "tidak ada" untuk pinning/konfigurasi yang dibangun runtime.
- Split ABI & modul React Native (`features.reactnativeapps`, 43 kelas) tidak berisi crypto yang discan di sini.
- Body metode yang didekompilasi: Intercom CryptoHelper (encrypt path lengkap), SessionStore-adjacent classes (fields only).
