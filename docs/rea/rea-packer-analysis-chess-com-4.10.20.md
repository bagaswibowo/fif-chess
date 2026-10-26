# REA: Analisis Packer/Protector — chess-com-4.10.20-base.apk

sha256 `d69ffbfb…e533` · v4.10.20-googleplay · REA/jadx 0.7.1 · statis

---

## Verdict: TIDAK di-pack / TIDAK ada protector — hanya R8 obfuscation

Hipotesis "obfuscated or packed" terjawab dengan pembuktian negatif yang sistematis. APK ini **bisa dianalisis penuh secara statis tanpa unpacking** — seperti yang dibuktikan sendiri oleh sesi-sesi analisis sebelumnya (57.929 kelas ter-load, ratusan body metode terdekompilasi, 136 schema Room terbaca, XML backup rules terdekompilasi).

### Bukti negatif (semua [OBS] — scan langsung DEX/ZIP)

**1. Fingerprint packer: 0 kecocokan**
Scan 11 DEX terhadap marker semua packer utama:
- Tencent Legu/TP (`tx_metashell`, `libtprt`, `SecShell`) → 0 (kecocokan `tup_` yang muncul 5× ternyata substring dari `gads:safe_brow…`/string lain — false positive, diverifikasi konteks)
- 360 Jiagu (`libjiagu`, `com.stub.StubApp`, `qihoo`) → 0
- Bangcle/SecNeo, Ijiami, DexProtector, Ali protect, Baidu, Promon SHIELD → 0
- Entri ZIP mencurigakan (`stub/jiagu/shell/secneo/protect/exec`) di APK full → tidak ada

**2. DEX headers valid semua** — 11 DEX, magic `dex\n039\0`, declared_size == actual size semua OK. Tidak ada DEX terenkripsi/tersembunyi/overlaid.

**3. Tidak ada loader stub native** — `lib/` kosong di base & full APK (0 file .so); split ABI belum dianalisis tapi manifest `requiredSplitTypes=base__abi` adalah split Play Store standar, bukan packer.

**4. Application class asli** — `com.chess.MainApplication` terdaftar di manifest dan kelasnya ada di classpath (bukan stub delegating ke encrypted dex).

**5. Dynamic loading: tidak ada**
- `InMemoryDexClassLoader`: 0
- `DexClassLoader`: 3 kecocokan — semuanya referensi tipe di constant pool library (AdMob adapter `VungleInterstitialAdapter`, protobuf, BaseDexClassLoader type check) — bukan pemakaian runtime oleh app [OBS konteks]
- Bypass hidden-API / meta-reflection: 0

**6. Reflection normal saja** — `getDeclaredMethod` 19×, `setAccessible` 9×: level wajar untuk SDK (Dagger/Gson/RN), bukan self-decryption.

### Yang memicu kesan "obfuscated" — dan diagnosisnya

| Gejala | Sebab sesungguhnya |
|---|---|
| Nama kelas/metode satu huruf (`a`, `b`, `tw0`, `ym2`, `uk9$a`) | **R8 full-mode** (minify+shrink) — footer DEX memuat konfigurasi build terbaca: `~~R8{"backend":"dex","compilation-mode":"release","r8-mode":"full","version":"8.13.19"}` + pg-map-id per DEX [OBS] |
| String yang tampak acak | Bukan enkripsi string — semua string penting (endpoint, header `x-chesscom-*`, schema SQL, Twirp service names) plaintext di string pool |
| `assets/*.bin` misterius (`aggressive.bin`, `nakamura.bin`, dll) | **Bukan payload packer** — header `@PG@\n1.0` = buku pembukaan PGN (opening books) untuk bot catur [OBS header bytes] |

### Peta: statis-visible vs deferred-to-runtime

**Statis-visible (sudah diekstrak di sesi sebelumnya):**
- Seluruh arsitektur: 146 modul fitur, 57.929 kelas, manifest lengkap
- Transport: Twirp/Retrofit (`analysis.chess.com/twirp/`), WebSocket (`wss://analysis.chess.com/v2/game-review`), CometD (`live2.chess.com/cometd`)
- 75 proto services, 136 tabel Room, DB/DataStore/prefs naming, backup rules XML
- Business logic terpilih: AppsFlyerManager chain, Daily Puzzle chain, Intercom CryptoHelper

**Deferred to runtime (bukan karena packer, tapi secara inheren):**
- **Split ABI .so** (ARM/x86 splits Play Store, tidak ada di file ini) — jika ada native code, butuh APK split masing-masing ABI
- **Nilai konfigurasi runtime**: feature flags (`FeatureFlag.y3/z3` — nilai dari remote config `chesscom.configurator.v3/v4`), API keys yang diinject build-time (values dari resources/BuildConfig, bukan string DEX)
- **React Native bundle** (`features.reactnativeapps`, 43 kelas; JS bundle di assets RN — logika layar RN ada di JS, bukan DEX)
- **Pinning/netsec dinamis**: keputusan TLS bisa diubah via remote config — tidak terlihat statis
- Behavior AppsFlyer/ads SDK final (endpoint dibentuk format-string)

### Langkah minimal & aman untuk "kode asli" (jika tetap dibutuhkan)

Karena tidak ada packer, tidak perlu unpacking/dumping memori. Yang tersisa:

1. **Split ABI** — unduh APK split per-ABI (bundletool `build-apks --mode=universal` atau download via Play) → akses .so jika ada; analisis dengan REA native tools (`inspect_native_load_image`, dll). Risiko: nol (statis).
2. **String deobfuscation (jika diinginkan)** — mapping R8 dapat diminta via `retrace` jika punya mapping file (yang TIDAK ada di APK; pg-map-id di DEX adalah ID hash, bukan mapping-nya). Tanpa mapping: baca intent via tipe/signature (cara yang sudah dipakai di sesi ini).
3. **RN bundle** — ekstrak `assets/` JS bundle, jalankan `react-native-decompiler`/Hermes bytecode decompiler jika Hermes. Statis, aman.
4. **Runtime verification (opsional, paling invasif)** — emulator dengan Frida untuk: konfirmasi pinning (bypass test), dump nilai feature flags, trace `SessionStore` persistensi token. HANYA di emulator yang kamu kontrol, bukan device produksi; ini melanggar ToS chess.com jika dipakai terhadap server mereka — batasi ke observasi lokal.
5. **Yang TIDAK perlu dilakukan**: dumping dex dari memori, patching loader stub, anti-anti-frida — tidak ada targetnya di APK ini.

### Catatan keamanan analisis
Semua langkah di atas statis dan tidak menyentuh server chess.com maupun sxz-server. Runtime/Frida hanya relevan untuk verifikasi perilaku, bukan untuk mengungkap kode (karena kode sudah sepenuhnya statis-accessible).
