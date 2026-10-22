/**
 * lib/endgame-drills.ts (ticket S4-T4)
 * Kurasi statis set drill endgame dari puzzle bertema endgame existing
 * (kolom `puzzles.themes` — GIN index). Mapping set→puzzle ids adalah
 * konstanta hasil kurasi psql (bukan generated, bukan tabel baru —
 * docs/db/sprint4.md keputusan #1 YAGNI).
 *
 * Sumber kurasi (psql, 2026-10-22):
 *   SELECT id FROM puzzles WHERE '<theme>' = ANY(themes) ORDER BY rating LIMIT 8
 * Semua id diverifikasi ada di tabel puzzles dan bertema endgame.
 */

export type DrillSet = {
  /** id set stabil, dipakai di path api/endgames/drills/[setId]/next */
  id: string;
  title: string;
  description: string;
  /** Tema `puzzles.themes` sumber set (dipakai query SQL-side per set). */
  theme: string;
  /** Id puzzle hasil kurasi statis (urut rating naik). */
  puzzleIds: string[];
};

export const DRILL_SETS: DrillSet[] = [
  {
    id: "rook-endgame",
    title: "Benteng vs Bidak",
    description: "Teknik fundamental benteng di permainan akhir.",
    theme: "rookEndgame",
    puzzleIds: [
      "1b153273-d56e-4808-9c44-f4dde1768501",
      "a3bc99a5-10fe-4088-bcb6-d9aee119877b",
      "5cc57010-0d6c-4b63-8f59-43cbb4bdc55b",
      "0db1b4cd-8ce1-4142-b905-8181ab629ab8",
      "ce46db3c-f20e-406b-b306-19c1de18d8e6",
      "36baedb4-136d-4761-84a1-85c51d797861",
      "39da2ea4-ed6d-47cf-8d56-1ee6c572ea29",
      "164cc1f7-30d0-4e9d-bb61-1429eb7c9182",
    ],
  },
  {
    id: "pawn-endgame",
    title: "Pion Akhir",
    description: "Raja aktif dan pion lolos — inti endgame pion.",
    theme: "pawnEndgame",
    puzzleIds: [
      "fa85dcc1-701b-4960-a8de-c0b9228d6ad2",
      "0b5efe67-2e8d-46b2-9449-c9082501e3b2",
      "c5f6c497-6fb7-4d88-8700-713f03c1e931",
      "793ab003-25a7-476a-8c0d-4a210bf04998",
      "78f0fcfe-9016-42a6-abce-f687e4597741",
      "3d23f3db-3f0a-4896-a2af-705719e581f8",
      "aa3608e3-10f1-45a5-869e-15acbd5f7c6d",
      "4878fa24-d6fa-43f9-b882-f908dfa9b6ee",
    ],
  },
  {
    id: "bishop-endgame",
    title: "Perwira: Ganda",
    description: "Ganda aktif mengendalikan diagonal di akhir permainan.",
    theme: "bishopEndgame",
    puzzleIds: [
      "9fdb058d-feff-475f-9df8-782e7acbdaa4",
      "b6794be4-f415-40cd-a68f-56581821274e",
      "35ec1097-9509-4068-ae69-3891600a7a9c",
      "0c6a6439-bd6c-42be-bddd-d153c1cc01e2",
      "3b1bc6db-5a4b-4fb6-8f35-07335344910e",
      "ccc50355-8b97-49b8-bdb8-573338b4e843",
      "332b6225-d508-4eb5-849b-7d28fe9abd22",
      "9a930379-4d45-4a74-aa76-c5a441a51079",
    ],
  },
  {
    id: "knight-endgame",
    title: "Perwira: Kuda",
    description: "Kuda melompat mengunci pion di permainan akhir.",
    theme: "knightEndgame",
    puzzleIds: [
      "4f515423-605c-4dd5-a035-ab3481001a95",
      "10109307-1252-48d3-9e61-e5ed93ee02ed",
      "aab8d43b-24e4-435c-8f29-974364cfae4a",
      "f1d74740-199e-463b-817f-936bfb672db3",
      "d66462ec-686c-4277-91d5-962b7bd0b7e6",
      "fdc56e51-4c42-40b9-acbc-1a0b26f0f8d4",
      "1f74fcf0-9833-4952-bb1b-f6adb29446a0",
      "fb086d12-7b09-4890-a0a5-4d64eb25e7e0",
    ],
  },
  {
    id: "queen-endgame",
    title: "Menteri Mati",
    description: "Materi menteri — mati dan promosi.",
    theme: "queenEndgame",
    puzzleIds: [
      "eaa3a8d6-b4f0-4fa5-80ef-4cfb7904ab23",
      "a7d36093-6193-4c61-884d-aad00e414cb9",
      "a0c527be-e18c-4f55-bce3-db766f725dac",
      "c3d5485c-4ed6-41b1-bef6-293f57d0ea7a",
      "74ac492c-4ea2-445b-b88d-5b2009ae5faf",
      "9c011001-f490-41e1-8a81-7d4ff7df6d53",
      "cdc548d1-40cb-468d-b373-068560090a1f",
      "9d6a2b76-0394-4314-8f14-a60dd17b8299",
    ],
  },
  {
    id: "queen-rook-endgame",
    title: "Menteri + Benteng",
    description: "Kombinasi menteri-benteng: serangan matis berat.",
    theme: "queenRookEndgame",
    puzzleIds: [
      "a4640090-aceb-48db-b684-09923ff5bb21",
      "680aa3fc-2802-4901-8177-cb24f309523f",
      "f68b3c95-e55b-4b73-8313-ca1390282606",
      "cf30f5e7-5b0c-40c2-b4c3-e94d2931dbe7",
      "8a0fe661-2961-448c-89f2-50cefce96762",
      "e7b71897-3839-4686-882c-7d7bd1c248db",
      "21682c7d-9f62-4287-9b4c-8174f642cb4f",
      "0a1aab94-1e2c-4d4b-9b3a-535f9cee656f",
    ],
  },
];

export function drillSetById(setId: string): DrillSet | null {
  return DRILL_SETS.find((s) => s.id === setId) ?? null;
}
