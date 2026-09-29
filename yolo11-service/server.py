"""
YOLOv11 Chess Piece Detection Service
=====================================
Deteksi bidak catur dari foto papan fisik menggunakan YOLOv11 (Ultralytics),
plus deteksi 4 sudut papan gaya OMR-Scanner (Canny -> contours -> quad
terbesar -> urutkan sudut -> warp perspektif).

Pipeline scan penuh (endpoint /predict):
1. (Opsional) Deteksi & warp papan otomatis bila `autoCrop: true`.
2. Jalankan YOLOv11 untuk mendeteksi bidak (12 kelas: 6 jenis x 2 warna).
3. Peta pusat setiap deteksi ke petak papan 8x8.
4. Rekonstruksi FEN secara deterministik.

Endpoint:
- GET  /health   -> status service & model
- POST /corners  -> deteksi 4 sudut papan (gaya OMR-Scanner) untuk preview modal crop
- POST /predict  -> { image, autoCrop?, prewarped? } => { ok, fen, board_fen, engine }
"""

import base64
import io
import logging
import math
import os

import numpy as np
import chess
import cv2
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel

logger = logging.getLogger("yolo11-chess")
logging.basicConfig(level=logging.INFO)

MODEL_PATH = os.environ.get("YOLO_MODEL_PATH", "/app/models/best.pt")
CONF_THRESHOLD = float(os.environ.get("YOLO_CONF_THRESHOLD", "0.25"))

# Kelas YOLO -> karakter FEN. Nama kelas di dataset harus persis seperti ini
# (lihat scripts/train-yolo11.md untuk detail dataset & pelatihan).
CLASS_TO_FEN = {
    "white-pawn": "P", "white-knight": "N", "white-bishop": "B",
    "white-rook": "R", "white-queen": "Q", "white-king": "K",
    "black-pawn": "p", "black-knight": "n", "black-bishop": "b",
    "black-rook": "r", "black-queen": "q", "black-king": "k",
}

_model = None


def load_model():
    global _model
    if _model is not None:
        return _model
    try:
        from ultralytics import YOLO
        if not os.path.exists(MODEL_PATH):
            logger.warning("Model belum ada di %s. Jalankan pelatihan dulu (scripts/train-yolo11.md).", MODEL_PATH)
            return None
        _model = YOLO(MODEL_PATH)
        logger.info("YOLOv11 model loaded dari %s", MODEL_PATH)
        return _model
    except Exception as e:
        logger.error("Gagal memuat model YOLO: %s", e)
        return None


app = FastAPI(title="YOLOv11 Chess Piece Detection API")


class ScanRequest(BaseModel):
    image: str
    # autoCrop: deteksi 4 sudut papan otomatis (gaya OMR-Scanner), warp
    # perspektif ke persegi, lalu deteksi bidak pada hasil warp.
    autoCrop: bool = False
    # prewarped: gambar sudah di-warp persegi oleh PerspectiveCropModal client.
    prewarped: bool = False
    # Kalibrasi dari client (PerspectiveCropModal): petak kiri-atas paling gelap
    # memberi tahu orientasi warna petak (a8 gelap), dan koordinat petak
    # kanan-bawah memberi tahu sisi mana yang dekat kamera. Keduanya opsional;
    # default mengasumsikan orientasi standar.
    darkestTopLeft: dict | None = None
    bottomRight: dict | None = None


def decode_image(image_b64: str) -> np.ndarray:
    data = image_b64
    if "base64," in data:
        data = data.split("base64,")[1]
    img_bytes = base64.b64decode(data)
    pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    arr = np.array(pil)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def order_corner_points(pts: np.ndarray) -> list:
    """Urutkan 4 titik: [TL, TR, BR, BL] — seperti OMR-Scanner."""
    pts = pts.reshape(4, 2).astype(np.float32)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).ravel()
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(diff)]
    bl = pts[np.argmax(diff)]
    return [tl, tr, br, bl]


def four_point_transform(image: np.ndarray, pts: list, size: int = 800) -> np.ndarray:
    """Warp perspektif quad -> persegi size x size (OMR-Scanner style)."""
    rect = np.array(pts, dtype=np.float32)
    dst = np.array(
        [[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (size, size))


def detect_board_corners(image: np.ndarray):
    """
    Deteksi 4 sudut papan catur, mengikuti pendekatan OMR-Scanner:
    grayscale -> blur -> Canny -> findContours -> approxPolyDP quad terbesar.
    Return [TL, TR, BR, BL] dalam koordinat piksel asli, atau None.
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Kandidat quad terbesar (area >= 20% gambar), coba beberapa epsilon.
    image_area = h * w
    best = None
    best_area = 0
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:12]:
        area = cv2.contourArea(c)
        if area < image_area * 0.2:
            break
        for eps in (0.02, 0.03, 0.05, 0.08):
            approx = cv2.approxPolyDP(c, eps * cv2.arcLength(c, True), True)
            if len(approx) == 4 and cv2.isContourConvex(approx):
                pts = order_corner_points(approx.reshape(4, 2))
                side = min(
                    np.linalg.norm(pts[1] - pts[0]),
                    np.linalg.norm(pts[2] - pts[1]),
                    np.linalg.norm(pts[3] - pts[2]),
                    np.linalg.norm(pts[0] - pts[3]),
                )
                if area > best_area and side > min(h, w) * 0.45:
                    best = pts
                    best_area = area
                break

    if best is None:
        return None

    # Perlebar quad sedikit ke luar supaya petak tepi (a/h file, rank 1/8)
    # tidak terpotong — bidak di petak tepi masih utuh.
    center = best.mean(axis=0)
    expanded = []
    for p in best:
        v = p - center
        expanded.append(p + v * 0.02)
    return np.array(expanded, dtype=np.float32)


@app.get("/health")
def health():
    model = load_model()
    return {
        "status": "ok",
        "service": "yolo11-chess",
        "model_loaded": model is not None,
        "model_path": MODEL_PATH,
    }


class CornersRequest(BaseModel):
    image: str


@app.post("/corners")
def corners(req: CornersRequest):
    """
    Deteksi 4 sudut papan gaya OMR-Scanner. Dipakai PerspectiveCropModal
    untuk preview auto-detect; user tetap bisa geser sudut manual.
    Return normalized corners [TL, TR, BR, BL] in [0..1] + debug image.
    """
    try:
        img = decode_image(req.image)
        pts = detect_board_corners(img)
        if pts is None:
            return {"ok": False, "error": "Papan tidak terdeteksi otomatis. Geser 4 sudut secara manual."}
        h, w = img.shape[:2]
        norm = [
            {"x": round(float(p[0]) / w, 5), "y": round(float(p[1]) / h, 5)}
            for p in pts
        ]
        # Debug overlay: gambar quad di atas foto
        dbg = img.copy()
        cv2.polylines(dbg, [pts.astype(np.int32)], True, (0, 255, 0), 3)
        for p, name in zip(pts, ["A8/TL", "H8/TR", "H1/BR", "A1/BL"]):
            cv2.circle(dbg, (int(p[0]), int(p[1])), 9, (0, 0, 255), -1)
            cv2.putText(dbg, name, (int(p[0]) + 12, int(p[1]) - 12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
        _, buf = cv2.imencode(".jpg", dbg, [cv2.IMWRITE_JPEG_QUALITY, 85])
        dbg_b64 = "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()
        return {"ok": True, "corners": norm, "debug": dbg_b64}
    except Exception as e:
        logger.error("Corner detection failed: %s", e, exc_info=True)
        return {"ok": False, "error": "Gagal memproses gambar."}


def detect_pieces(img_np: np.ndarray):
    """Jalankan YOLOv11, kembalikan daftar (kelas_fen, cx, cy, conf)."""
    model = load_model()
    if model is None:
        raise HTTPException(status_code=503, detail="Model YOLOv11 belum tersedia. Latih dulu (scripts/train-yolo11.md).")

    results = model.predict(img_np, conf=CONF_THRESHOLD, verbose=False)
    detections = []
    for r in results:
        names = r.names
        for box in r.boxes:
            cls_name = names[int(box.cls[0])]
            fen_char = CLASS_TO_FEN.get(cls_name)
            if fen_char is None:
                continue
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            detections.append((fen_char, (x1 + x2) / 2.0, (y1 + y2) / 2.0, conf))
    return detections


def grid_fen(detections, img_w: int, img_h: int) -> str:
    """Peta deteksi ke grid 8x8 dan susun FEN board (rank 8 -> rank 1)."""
    board = [[""] * 8 for _ in range(8)]
    for fen_char, cx, cy, _conf in detections:
        col = min(7, max(0, int(cx / img_w * 8)))
        row = min(7, max(0, int(cy / img_h * 8)))
        # row 0 = baris teratas gambar = rank 8
        board[row][col] = fen_char

    ranks = []
    for row in board:
        fen_rank, empty = "", 0
        for sq in row:
            if sq == "":
                empty += 1
            else:
                if empty > 0:
                    fen_rank += str(empty)
                    empty = 0
                fen_rank += sq
        if empty > 0:
            fen_rank += str(empty)
        ranks.append(fen_rank)
    return "/".join(ranks)


def plausible_board_fen(board_fen: str) -> bool:
    """Cek cepat: FEN board masuk akal (raja tunggal, bidak <= 16/sisi, dst)."""
    try:
        board = chess.Board(board_fen + " w - - 0 1")
        pieces = list(board.piece_map().values())
        white = [p for p in pieces if p.color == chess.WHITE]
        black = [p for p in pieces if p.color == chess.BLACK]
        if len(white) > 16 or len(black) > 16:
            return False
        if sum(1 for p in white if p.piece_type == chess.KING) != 1:
            return False
        if sum(1 for p in black if p.piece_type == chess.KING) != 1:
            return False
        if sum(1 for p in white if p.piece_type == chess.PAWN) > 8:
            return False
        if sum(1 for p in black if p.piece_type == chess.PAWN) > 8:
            return False
        # Pion tidak boleh berada di rank 1/8
        for sq, piece in board.piece_map().items():
            if piece.piece_type == chess.PAWN and chess.square_rank(sq) in (0, 7):
                return False
        return True
    except Exception:
        return False


@app.post("/predict")
def predict(req: ScanRequest):
    try:
        img = decode_image(req.image)

        # Opsional: auto-crop gaya OMR-Scanner sebelum deteksi bidak.
        if req.autoCrop and not req.prewarped:
            pts = detect_board_corners(img)
            if pts is not None:
                img = four_point_transform(img, pts, size=800)
                logger.info("Auto-crop papan berhasil (quad %s)", pts.tolist())

        h, w = img.shape[:2]
        detections = detect_pieces(img)
        board_fen = grid_fen(detections, w, h)

        if not plausible_board_fen(board_fen):
            return {
                "ok": False,
                "error": "Deteksi YOLO menghasilkan posisi yang tidak masuk akal (raja hilang/ganda, pion ilegal, atau bidak berlebih). Perbaiki manual di papan referensi.",
                "detections": len(detections),
                "board_fen_candidate": board_fen,
            }

        return {
            "ok": True,
            "fen": board_fen + " w - - 0 1",
            "board_fen": board_fen,
            "detections": len(detections),
            "engine": "yolo11",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Prediction failure: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
