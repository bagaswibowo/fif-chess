# S7 — Learn Layer (Tikets)

**Role**: PM · **Kanban**: S7 dari `docs/tickets/S6-sprint-plan.md` · Repo canon `main`.
Guardrail global sama dengan S6: anti-slop, no-mock (progres/angka selalu dari data riil),
YAGNI/minimal-diff, a11y floor, aset chess.com tidak disalin (referensi deskriptif saja).

## Konteks baseline
- `lib/learning-hub.ts` + `components/views/learning-hub.tsx` sudah berisi materi tutorial
  13 bab taktik (Bain) + quest — pattern konten statis terkurasi sudah terbukti.
- `app/api/endgames/drills` + `endgame-drills-view.tsx` (S4) = pattern "6 set kurasi + progress
  dari tabel riil" yang mau ditiru.
- Absen saat ini: courses (jalur pelatihan terstruktur), lessons/lessons-opening interaktif,
  practice drills, classroom, dan multi-filter /endgames + leaderboard endgame.

## Tiket

### S7-T1 — Courses (`/courses` + deep-link course id)
Jalur pelatihan terstruktur ala chess.com (mis. "Knights vs Bishops") sebagai
**konten statis terkurasi** (`lib/courses.ts`: list course → steps, tiap step = set materi
tutorial/position drill yang JUALAH ada di learning-hub/endgame-drills — tidak bikin konten
baru dari nol, YAGNI). Progress = riil: selesaikan step N tercatat (lihat DB engineer untuk
pilihan: re-used table learning_progress atau reuse quiz/quest existing). View: daftar course
card + progress bar % per course + course-detail ber-page steps, CTA "Lanjut".

### S7-T2 — Lessons & Openings Lessons (`/learn` upgrade)
Katalog pelajaran interaktif: video placeholder HONEST (tidak ada aset video — tampilkan
"materi tertulis" dengan ilustrasi papan/posisi, tidak fake-video), tantangan per lesson,
bookmark. Openings lesson = katalog pembukaan dari `lib/engines/opening-book.ts` (riil, sudah
ada) + mode belajar (terangkan → tantangan → kemahiran). Cross-link dari Explorer (S6-T1 CTA
"Materi" sudah me-prepare flag `hasLessons`).

### S7-T3 — Practice (`/practice`)
Drill terstruktur ringan: pilihan kategori (tactical motif / endgame / opening) → drill
existing (puzzle themes S3 + endgame drills S4) satu pintu masuk, plus target mingguan
(progress riil dari `puzzle_attempts`).

### S7-T4 — Classroom (`/classroom`)
Join by room ID + board collab: reuse PvpRoom/WS bus existing, mode "saling jelaskan"
(annotate board bersama), tanpa AI matching. YAGNI: 1 room code, 2 pemain, move + catatan
teks; tanpa persistent rekaman.

### S7-T5 — Endgames multi-filter + leaderboard (`/endgames`)
View drill endgame sudah ada (S4-T4). Tambah: filter tema + filter progress, dan
leaderboard drills (riil dari `puzzle_attempts` + tabel drill — DB engineer tentukan
sumber).

## Gate
Designer (flow/copy/state) ∥ Architect (ADR + kontrak) ∥ DB (skema progress riil, hindari
duplikasi table) → Backend ∥ Frontend (kontrak single source) → TL regression-first →
DevOps (push fif-chess + rebuild Docker + redeploy sxz + smoke) — pola S6.
