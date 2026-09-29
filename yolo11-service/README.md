# Instalasi & verifikasi service YOLOv11

Model bidak catur **tidak perlu diunduh manual**: entrypoint container
otomatis mengunduh pretrained chess model (yolo11n fine-tune, 12 kelas
`white-pawn`..`black-king`, ±5 MB) dari HuggingFace saat start, dan menyimpannya
di `models/yolo11/best.pt` (volume, jadi hanya diunduh sekali).

Sumber default bisa diganti via env `YOLO_MODEL_URL`, atau timpa dengan model
hasil latihan sendiri di `models/yolo11/best.pt` (lihat scripts/train-yolo11.md).

1. Jalankan bersama seluruh stack:
   ```
   docker compose up -d --build
   ```
2. Verifikasi:
   ```
   curl http://localhost:8100/health
   # harus: {"status":"ok","model_loaded":true,...}
   ```
4. Test deteksi sudut papan (gaya OMR-Scanner, dipakai modal crop):
   ```
   curl -X POST http://localhost:8100/corners \
     -H 'Content-Type: application/json' \
     -d '{"image": "data:image/jpeg;base64,..."}'
   # return: {"ok":true,"corners":[{x,y}x4 TL,TR,BR,BL],"debug":"data:image/jpeg..."}
   ```
5. Test prediksi manual:
   ```
   curl -X POST http://localhost:8100/predict \
     -H 'Content-Type: application/json' \
     -d '{"image": "data:image/jpeg;base64,..."}'
   ```
6. Dari aplikasi, import foto papan seperti biasa. Log Next.js akan
   menampilkan engine `yolo11` pada response scan, dan console Next
   mencatat "YOLO11 service skipped" bila service tidak jalan.
