# REA — Reverse-Engineer-Anything: Analisis Chess.com Web + APK

Dokumen hasil analisis REA (REverse-engineer-Anything) terhadap chess.com untuk referensi
parity jev-chess: APK 4.10.20 (native/packer/storage/crypto), blueprint web, feature-map menu,
dan UI/UX analysis. **Semua padanan di jev-chess dibuat original** — tidak ada aset, teks,
font, atau ikon berhak-cipta chess.com yang disalin (invariant anti-slop + no-mock).

## Index

| File | Isi |
|---|---|
| `chess-com-app-4.10.20-SPEC.md` | SPEC REA — scope, metode, deliverable |
| `chess-web-blueprint.md` | Blueprint arsitektur web chess.com (stack, realtime, PWA) |
| `chess-web-menu-feature-map.md` | Peta 7 grup menu + fitur per halaman |
| `chess-web-ui-ux-analysis.md` | Analisis pola UI/UX (palet token, onboarding, feedback langkah) |
| `jev-chess-rea-plan.md` | Rencana implementasi parity di jev-chess |
| `rea-report-chess-com-4.10.20.md` | Laporan REA APK — ringkasan temuan |
| `rea-feature-trace-chess-com-4.10.20.md` | Trace fitur APK → kode native |
| `rea-packer-analysis-chess-com-4.10.20.md` | Analisis packer & proteksi APK |
| `rea-storage-crypto-chess-com-4.10.20.md` | Skema storage & enkripsi APK |
| `chess-web-member-area-capture.md` | **Member-area capture live** (login cookie-import, `id_ID`) |

## Konvensi legal

Hanya **pola UX / struktur visual** yang diambil dari referensi; seluruh padanan jev-chess
(CSS token, SVG lucide, copy Indonesia) dibuat original. Angka statistik di jev-chess selalu
riil dari endpoint API (invariant no-mock), tidak disalin dari sumber publik.
