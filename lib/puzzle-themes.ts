/**
 * lib/puzzle-themes.ts (S3-T4)
 * 26 tema Lichess resmi + label Indonesia. Key = tema di dump Lichess
 * (pipe/spi plus-separated per puzzle di kolom Themes).
 */
export const THEME_LIST: { key: string; label: string }[] = [
  { key: "mate", label: "Skemat" },
  { key: "mateIn1", label: "Skemat 1 Langkah" },
  { key: "mateIn2", label: "Skemat 2 Langkah" },
  { key: "mateIn3", label: "Skemat 3 Langkah" },
  { key: "mateIn4", label: "Skemat 4 Langkah" },
  { key: "fork", label: "Garpu" },
  { key: "pin", label: "Pin" },
  { key: "skewer", label: "Sulur" },
  { key: "discoveredAttack", label: "Serangan Tertutupi" },
  { key: "backRankMate", label: "Skemat Baris Belakang" },
  { key: "endgame", label: "Akhir Permainan" },
  { key: "opening", label: "Pembukaan" },
  { key: "middlegame", label: "Pertengahan Permainan" },
  { key: "sacrifice", label: "Kurban" },
  { key: "hangingPiece", label: "Bidak Menggantung" },
  { key: "trapping", label: "Penjebakan" },
  { key: "deflection", label: "Defleksi" },
  { key: "quietMove", label: "Langkah Tenang" },
  { key: "xRayAttack", label: "Serangan Sinar-X" },
  { key: "interference", label: "Interferensi" },
  { key: "advantage", label: "Keunggulan" },
  { key: "defensiveMove", label: "Langkah Bertahan" },
  { key: "promotion", label: "Promosi" },
  { key: "long", label: "Panjang" },
  { key: "veryShort", label: "Sangat Pendek" },
  { key: "oneMove", label: "Satu Langkah" },
];

export const THEME_KEYS = new Set(THEME_LIST.map((t) => t.key));

export function themeLabel(key: string): string {
  return THEME_LIST.find((t) => t.key === key)?.label ?? key;
}
