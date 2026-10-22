# Sprint 1 — DB Design (Seek Pool & Challenge)

**Status:** Proposed · **Date:** 2026-10-22 · **Scope:** S1-T2 (seek pool), S1-T4 (challenge)
**Prinsip:** anti-redundancy, normalisasi, minimal diff, YAGNI. User model existing — tidak diubah.

## Ringkasan Keputusan

| Area | Keputusan | Model baru? |
|---|---|---|
| Seek pool (S1-T2) | Redis ZSET only, ephemeral | Tidak |
| Audit game terbentuk (S1-T2) | Sudah tercakup model `Game` | Tidak |
| Challenge (S1-T4) | Persist di Postgres | **Ya: `Challenge`** |

## 1. Seek Pool — Redis-only, tanpa model Prisma

**Keputusan:** seek ticket hidup di Redis ZSET (`byes` rating → member = ticket JSON/id), sesuai ticket S1-T2 poin 3 dan YAGNI.

**Alasan:**
- Seek adalah intent sementara: umur hitungan detik–menit, hilang saat disconnect/cancel. Tidak ada query historis "siapa pernah seek" yang dibutuhkan fitur mana pun.
- Durability seek tidak diinginkan — server restart seharusnya mengosongkan pool, bukan memunculkan seek zombie.
- Atomic matching (ZADD/ZPOPMIN dalam Lua/multi) lebih mudah di Redis daripada row-locking di Postgres.
- Game yang TERBENTUK dari match sudah punya jejak audit permanen: row `Game` (white_user_id, black_user_id, started_at, status). Itulah satu-satunya fakta yang perlu diaudit.

**Struktur Redis (konvensi, bukan schema):**
- Key: `seek:pool:{tc}:{casual|rated}` → ZSET, score = rating, member = `seekId`.
- `seekId` → hash `seek:{seekId}` (userId, rating, tc, mode, createdAt) dengan TTL singkat.
- Idempotensi: ZPOPMIN + verifikasi hash; seek yang sudah match dihapus sebelum publish `GameAdded`.

## 2. Challenge — butuh model `Challenge`

**Keputusan:** S1-T4 butuh satu model baru. Kalau challenge yang diterima/ditolak hanya lewat Redis Stream (`matcher/<userId>`, di-XTRIM), maka:
- Penerima tidak punya bukti siapa meng-challenge (stream ter-trim / hilang setelah restart).
- Pengirim tidak bisa melihat status challenge outstanding; refresh halaman = challenge hilang.
- Tidak ada jejak audit keputusan (diterima/ditolak/dibatalkan/expire).

Challenge adalah keputusan dua pihak yang lintas sesi — state itu harus durable dan queryable, tidak bisa episodic seperti seek.

**Desain (normalisasi — tidak ada duplikasi data Game):**

```prisma
model Challenge {
  id          String    @id @default(uuid())
  from_user_id String
  to_user_id  String
  time_control String   // mis. "10+0" — referensi TC, bukan duplikasi logika clock
  rated       Boolean   @default(false)
  status      String    @default("pending") // pending | accepted | declined | cancelled | expired
  game_id     String?   // terisi hanya saat accepted; relasi ke Game, TIDAK menyalin data game
  created_at  DateTime  @default(now())
  decided_at  DateTime? // waktu accept/decline/cancel/expire

  fromUser User  @relation("ChallengesSent",     fields: [from_user_id], references: [id])
  toUser   User  @relation("ChallengesReceived", fields: [to_user_id],   references: [id])
  game     Game? @relation(fields: [game_id], references: [id])

  @@index([to_user_id, status])    // inbox challenge outstanding penerima
  @@index([from_user_id, status])  // challenge outstanding pengirim (untuk cancel)
}
```

Catatan desain:
- `to_user_id` NOT NULL (challenge inline selalu ditujukan ke satu user; open challenge/lobby tidak ada di Sprint 1 — YAGNI). Field bisa dilonggarkan nanti kalau lobby jadi kebutuhan nyata.
- `game_id` nullable + FK: satu-satunya tautan ke hasil match. Challenge TIDAK menyalin rating/TC/result ke sini — baca dari `Game`.
- `status` String konsisten dengan konvensi schema existing (`Game.status` juga String); enum Prisma sengaja tidak dipakai agar minimal diff dan konsisten.
- Cleanup: `expired` di-set lazy saat dibaca (created_at > TTL) atau saat matcher sweep — tidak butuh cron baru.
- Relasi baru di `User` (`challengesSent`/`challengesReceived`) dan `Game` (`challenges`) adalah additive — tidak mengubah struktur/kolom User yang ada.

## 3. Migration snippet (JANGAN dijalankan oleh ticket ini — dijalankan saat implementasi S1-T4)

```bash
npx prisma migrate dev --name add_challenge
```

Perkiraan SQL yang dihasilkan (referensi review):

```sql
CREATE TABLE "Challenge" (
  "id" TEXT PRIMARY KEY,
  "from_user_id" TEXT NOT NULL REFERENCES "User"("id"),
  "to_user_id"   TEXT NOT NULL REFERENCES "User"("id"),
  "time_control" TEXT NOT NULL,
  "rated" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "game_id" TEXT REFERENCES "Game"("id"),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMP(3)
);
CREATE INDEX "Challenge_to_user_id_status_idx"   ON "Challenge"("to_user_id", "status");
CREATE INDEX "Challenge_from_user_id_status_idx" ON "Challenge"("from_user_id", "status");
```

## Alternatif yang ditolak

- **`Seek` model di Postgres:** state ephemeral, menambah write path panas tanpa manfaat query; Redis cukup (keputusan ticket S1-T2).
- **Challenge Redis-only:** kehilangan audit accept/decline dan outstanding state lintas refresh/restart.
- **Menyimpan snapshot hasil match di Challenge (TC efektif, result, dsb.):** duplikasi `Game`; `game_id` FK cukup.
- **Kolom audit `last_challenge_*` di User:** melanggar normalisasi (satu user bisa banyak challenge); tabel terpisah benar.
