# Melatih YOLOv11 untuk Deteksi Bidak Catur

Panduan lengkap membuat model `best.pt` untuk service `yolo11-service`.

## 1. Dataset

Opsi A — dataset publik siap pakai (paling cepat):
- **Chess Pieces Dataset (Roboflow)** — cari "chess pieces" di https://universe.roboflow.com,
  pilih dataset dengan 12–13 kelas (6 bidak × warna, kadang + `chess-board`).
- Format ekspor: **YOLOv8/YOLOv11** (kompatibel dengan Ultralytics).

Opsi B — buat sendiri dari render papan (kualitas tinggi, kontrol penuh):
1. Generate ribuan posisi acak (mis. dengan python-chess).
2. Render ke gambar papan dengan beberapa *skin* (lichess cburnett, wikipedia, dsb.)
   + variasi rotasi/pencahayaan/noise.
3. Anotasi otomatis: karena posisi diketahui, bounding box tiap bidak diketahui persis.

## 2. Struktur folder

```
dataset/
├── images/
│   ├── train/
│   └── val/
├── labels/
│   ├── train/
│   └── val/
└── data.yaml
```

`data.yaml` — **nama kelas harus persis seperti ini** (dipakai `yolo11-service/server.py`):

```yaml
path: ./dataset
train: images/train
val: images/val
names:
  0: white-pawn
  1: white-knight
  2: white-bishop
  3: white-rook
  4: white-queen
  5: white-king
  6: black-pawn
  7: black-knight
  8: black-bishop
  9: black-rook
  10: black-queen
  11: black-king
```

## 3. Latih

```bash
pip install ultralytics

yolo detect train \
  model=yolo11n.pt \
  data=dataset/data.yaml \
  epochs=100 \
  imgsz=640 \
  batch=16 \
  project=runs/chess \
  name=yolo11-chess
```

Tips:
- Mulai dari `yolo11n` (cepat). Jika akurasi kurang, naik ke `yolo11s` / `yolo11m`.
- Untuk foto papan nyata, tambahkan augmentasi: `mosaic=1.0`, `fliplr=0.0` (jangan flip — membalik posisi tidak realistis), `hsv_*` default.
- Ekspor ke gambar dari sudut kamera yang miring juga membantu (dataset Roboflow umumnya sudah termasuk).

## 4. Pasang model ke service

```bash
mkdir -p models/yolo11
cp runs/chess/yolo11-chess/weights/best.pt models/yolo11/best.pt
docker compose --profile yolo11 up -d --build
curl http://localhost:8100/health
```

Health check harus menampilkan `"model_loaded": true`. Setelah itu,
`/api/scan-board` otomatis memakai YOLOv11 sebagai engine utama
(sebelum Gemini/OpenAI VLM), dan hasil scan foto papan fisik jauh lebih
konsisten — tiap bidak dideteksi satu per satu, bukan ditebak.
