/**
 * lib/lessons.ts (S7-T2, ADR-010 D2) — Katalog lesson statis.
 *
 * Frontend mengimport modul ini langsung (pola lib/puzzle-data.ts) —
 * TIDAK ada endpoint katalog lesson (D2.1). Copy 100% orisinal
 * (HONEST: materi tertulis + ilustrasi papan, TANPA video / aset).
 *
 * Latihan interaktif per lesson memakai sumber REUSE (D2.2):
 *   - dbPuzzle   → id puzzle existing di DB; verifikasi + pencatatan
 *                  REUSE POST /api/puzzles/[id]/attempt.
 *   - bookMove   → FEN + "cari book move"; kandidat dari
 *                  lib/engines/opening-book.ts (client-side, TANPA
 *                  pencatatan server — UI wajib label "tidak tercatat").
 *   - themeDrill → tema drill; REUSE GET /api/puzzles/next?theme=
 *
 * Semua FEN boardFen di bawah diambil dari tabel puzzles riil
 * (verifikasi psql, 2026-10-27) — bukan posisi fiktif.
 */

export type LessonExercise =
  | { kind: "dbPuzzle"; puzzleId: string } // REUSE POST /api/puzzles/[id]/attempt
  | { kind: "bookMove"; fen: string } // REUSE data lib/engines/opening-book.ts
  | { kind: "themeDrill"; theme: string; count: number }; // REUSE GET /api/puzzles/next?theme=

export interface Lesson {
  /** stabil, dipakai bookmark + course step kind "lesson". */
  id: string;
  module: "tactics" | "openings" | "endgames" | "rules";
  /** copy ID original (HONEST: materi tertulis, TIDAK video). */
  title: string;
  /** teks lesson (markdown-ish plain). */
  body: string;
  /** ilustrasi papan (react-chessboard, posisi demo riil). */
  boardFen?: string;
  exercises: LessonExercise[];
  /** hanya module "openings" — wrap data existing (D3). */
  openingEco?: string;
}

export const LESSONS: Lesson[] = [
  {
    id: "tactics-pin",
    module: "tactics",
    title: "Membedakan Pin, Garpu, dan Serangan Tersembunyi",
    body:
      "Materi tertulis — tanpa video. Tiga motif taktikal paling sering muncul di permainan sedang:\n\n" +
      "**Pin (sorong)** — bidak tidak bisa bergerak karena akan mengungkap perwira/raja di belakangnya. " +
      "Pin ke raja ('pin absolut') memaksa lawan tetap di petak itu; pin ke bidak berharga ('pin relatif') bisa dipatahkan bila bidak itu cukup kuat.\n\n" +
      "**Garpu (fork)** — satu langkah mengancam dua bidak sekaligus (mis. kuda ke raja + menteri). " +
      "Selalu hitung: apakah patahan hanya satu, dan mana yang tidak bisa dipertahankan.\n\n" +
      "**Serangan tersembunyi (discovered attack)** — memindahkan bidak depan membuka serangan perwira di belakangnya; " +
      "serangan di petak yang sama sering berujung skakmat.\n\n" +
      "Latihan di bawah memakai pool puzzle riil — progres tercatat lewat POST /api/puzzles/[id]/attempt.",
    boardFen: "4q3/1pk5/p1p5/5N2/P1P2K2/1P2R3/8/8 b - - 1 42",
    exercises: [
      { kind: "dbPuzzle", puzzleId: "a14fcc2e-4f55-439a-b578-7c66891a8f77" },
      { kind: "themeDrill", theme: "fork", count: 5 },
      { kind: "themeDrill", theme: "pin", count: 5 },
    ],
  },
  {
    id: "tactics-back-rank",
    module: "tactics",
    title: "Memukul Baris Belakang",
    body:
      "Materi tertulis — tanpa video. Baris belakang (baris 1/8) adalah titik lemah klasik. " +
      "Begitu menara & pion penjaga menaiki pusat, raja yang belum rok kecil / rok besar kehilangan 'udara'.\n\n" +
      "Prinsip:\n" +
      "1. Jangan biarkan pion f/g/h naik tanpa rencana perlindungan baris.\n" +
      "2. Cari momen ketika menara & raja lawan terlokalisir di sudut sama — satu manuver (pion, keda, menara) membuka jalur skakmat.\n" +
      "3. 'Skakmat baris belakang' = menara di baris 1/8, raja terkurung, tidak ada perwira yang bisa menutup.\n\n" +
      "Kerjakan drill skakmat 1 langkah di bawah untuk mengenali pola secara refleks.",
    boardFen: "8/4kpp1/4p2p/1p6/3q4/3P1Q2/P4PPP/RR4K1 w - - 6 21",
    exercises: [
      { kind: "dbPuzzle", puzzleId: "36892246-88de-464e-aeb3-152a423107e4" },
      { kind: "themeDrill", theme: "backRankMate", count: 5 },
    ],
  },
  {
    id: "endgame-raja-aktif",
    module: "endgames",
    title: "Aktivitas Raja di Permainan Akhir",
    body:
      "Materi tertulis — tanpa video. Di permainan akhir, raja berubah dari target menjadi penyerang.\n\n" +
      "Aturan praktis:\n" +
      "1. **Centralisasi raja** dulu — selagi pion belum terpromosi, raja masuk ke tengah.\n" +
      "2. **Kontak pion lawan** — raja 'menjepit' pion lawan, paksa pion mundur/berangkat promosi.\n" +
      "3. **Kunci oposisi** — di endgame pion murni, raja yang di depan (sejajar) menguasai petak.\n\n" +
      "Set drill di bawah = benteng vs bidak & pion akhir (sumber riil lib/endgame-drills.ts). " +
      "Progres tercatat otomatis lewat attempt puzzle.",
    boardFen: "4b3/8/pp1p1p2/2pPpP2/P1P1P2k/1P6/5K2/3N4 w - - 0 35",
    exercises: [
      { kind: "dbPuzzle", puzzleId: "c73a9a86-46e6-4a93-ab09-438a32cc2247" },
      { kind: "themeDrill", theme: "endgame", count: 8 },
    ],
  },
  {
    id: "openings-ruy-lopez",
    module: "openings",
    title: "Ruy Lopez (C60)",
    openingEco: "C60",
    body:
      "Materi tertulis — tanpa video. Ruy Lopez: 1.e4 e5 2.Nf3 Nc6 3.Bb5. " +
      "Ganda mencengkeram kuda c6 — pin klasik — memaksa lawan memilih: 3...Nd4 (morphy), 3...Bc4 (berlin), atau 3...a6 (closed).\n\n" +
      "Fase awal: kontrol e5, siapkan rok besar. Fase gambit (opsional): c4 mengukir pusat. " +
      "Fase posisi: menara aktif ke baris terbuka, raja aman.\n\n" +
      "Latihan: ulangi 5 langkah pertama Ruy Lopez dari posisi awal (client memvalidasi vs buku pembukaan lokal — " +
      "tanpa pencatatan server). Lalu kerjakan drill riil tema pembukaan.",
    boardFen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    exercises: [
      { kind: "bookMove", fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" },
      { kind: "themeDrill", theme: "opening", count: 5 },
    ],
  },
  {
    id: "openings-kuda-raja",
    module: "openings",
    title: "Kuda Raja (C30)",
    openingEco: "C30",
    body:
      "Materi tertulis — tanpa video. 1.e4 e5 2.Nf3: kuda langsung mengancam pion e5 dan membuka diagonal g1-b5 " +
      "(King's Knight Opening, C30). Lawan bisa menjawab 2...Nc6, 2...Nf6, atau 2...d6 (Philidor).\n\n" +
      "Ide inti: cepat berkembang, rok besar, kontrol pusat lewat Nf3. Jangan gegabah mengambil pusat — jaga struktur pion.\n\n" +
      "Latihan: ulangi langkah pembuka dari posisi awal, lalu drill riil tema pembukaan.",
    boardFen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
    exercises: [
      { kind: "bookMove", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" },
      { kind: "themeDrill", theme: "opening", count: 5 },
    ],
  },
  {
    id: "rules-promosi",
    module: "rules",
    title: "Promosi Pion — Aturan & Kesalahan Umum",
    body:
      "Materi tertulis — tanpa video. Pion yang mencapai baris 8 (putih) / baris 1 (hitam) **harus** dipromosikan — " +
      "biasanya menjadi menteri, tapi kuda/ganda/mentari juga legal (under-promotion sering tersembunyi di soal taktikal).\n\n" +
      "Kesalahan umum:\n" +
      "1. Lupa aturan under-promotion saat 'skak' tersembunyi.\n" +
      "2. Promosi ke menteri di posisi yang justru mengunci bidak lain (fork tersembunyi).\n" +
      "3. Tidak melihat 'defleksi' — lawan mengorbankan pion agar promosi tersingkirkan.\n\n" +
      "Kerjakan drill promosi di bawah (sumber riil lib/endgame-drills.ts / tema puzzle).",
    boardFen: "764d5bdb-7b79-4390-8fdc-fa4dc7f7c550|rnbq1rk1/ppp1bppp/1n2pn2/2p1p3/1PP1PN2/2N1PN2/PP1PPP1P/R2QKB1R b KQ - 4 7",
    exercises: [
      { kind: "dbPuzzle", puzzleId: "764d5bdb-7b79-4390-8fdc-fa4dc7f7c550" },
      { kind: "themeDrill", theme: "promotion", count: 5 },
    ],
  },
];

export function lessonById(id: string): Lesson | null {
  return LESSONS.find((l) => l.id === id) ?? null;
}

export const LESSON_IDS = new Set(LESSONS.map((l) => l.id));
