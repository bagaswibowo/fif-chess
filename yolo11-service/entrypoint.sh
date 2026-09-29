#!/bin/sh
# Entrypoint: unduh model bidak catur pretrained (yolo11n fine-tuned,
# 12 kelas white-pawn..black-king) bila belum ada, lalu jalankan API.
set -e

MODEL_PATH="${YOLO_MODEL_PATH:-/app/models/best.pt}"
MODEL_URL="${YOLO_MODEL_URL:-https://huggingface.co/dopaul/chess-piece-detector-merged-v2/resolve/main/best.pt}"

if [ ! -f "$MODEL_PATH" ]; then
  echo "[yolo11] Model belum ada di $MODEL_PATH — mengunduh pretrained chess model..."
  echo "[yolo11] Sumber: $MODEL_URL"
  mkdir -p "$(dirname "$MODEL_PATH")"
  curl -sSL --fail --retry 3 --max-time 300 -o "$MODEL_PATH.tmp" "$MODEL_URL"
  mv "$MODEL_PATH.tmp" "$MODEL_PATH"
  echo "[yolo11] Model berhasil diunduh ($(du -h "$MODEL_PATH" | cut -f1))."
else
  echo "[yolo11] Model sudah ada: $MODEL_PATH"
fi

exec uvicorn server:app --host 0.0.0.0 --port 8100
