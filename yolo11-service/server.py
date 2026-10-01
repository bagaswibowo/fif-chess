"""
YOLOv11 Chess Piece Detection Service
=====================================
Pipeline scan foto papan catur:

1.  (Opsional, autoCrop) Deteksi 4 sudut papan (segmentasi warna petak /
    fallback Canny OMR-Scanner) lalu warp perspektif ke 800x800.
2.  KALIBRASI GRID: hasil warp hampir selalu menyertakan margin di luar 64
    petak (label a-h/1-8 papan vinyl, bingkai kayu, background screenshot),
    jadi pembagian kaku gambar/8 SELALU meleset. Kalibrasi mencari area 64
    petak sesungguhnya via skor checkerboard selang-seling.
3.  YOLOv11 mendeteksi tiap bidak (12 kelas) pada gambar yang sama dengan
    grid terkalibrasi.
4.  Peta pusat deteksi -> petak, susun FEN deterministik, validasi plausibel.

Endpoint:
- GET  /health   -> status service & model
- POST /corners  -> deteksi 4 sudut papan + gambar debug (untuk modal crop)
- POST /predict  -> { image, autoCrop?, prewarped? } => { ok, fen, board_fen }
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
from PIL import Image, ImageOps
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
            logger.warning("Model belum ada di %s.", MODEL_PATH)
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
    autoCrop: bool = False
    prewarped: bool = False


class CornersRequest(BaseModel):
    image: str


def decode_image(image_b64: str) -> np.ndarray:
    data = image_b64
    if "base64," in data:
        data = data.split("base64,")[1]
    img_bytes = base64.b64decode(data)
    pil = Image.open(io.BytesIO(img_bytes))
    # Wajib: foto HP/WhatsApp menyimpan rotasi di metadata EXIF, bukan piksel.
    pil = ImageOps.exif_transpose(pil).convert("RGB")
    arr = np.array(pil)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def order_corner_points(pts) -> np.ndarray:
    """Urutkan 4 titik: [TL, TR, BR, BL] — seperti OMR-Scanner."""
    pts = np.asarray(pts, dtype=np.float32).reshape(4, 2)
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).ravel()
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(diff)]
    bl = pts[np.argmax(diff)]
    return np.array([tl, tr, br, bl], dtype=np.float32)


def four_point_transform(image: np.ndarray, pts, size: int = 800) -> np.ndarray:
    """Warp perspektif quad -> persegi size x size (OMR-Scanner style)."""
    rect = np.asarray(pts, dtype=np.float32)
    dst = np.array(
        [[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (size, size))


def detect_board_corners(image: np.ndarray):
    """
    Deteksi 4 sudut papan. Dua strategi berurutan:
    1. Segmentasi warna petak gelap (hijau/coklat vinyl) via HSV + morphology
       close kuat -> blob papan -> minAreaRect -> rekonstruksi papan penuh.
    2. Fallback gaya OMR-Scanner: Canny -> contours -> quad convex terbesar.
    Return [TL, TR, BR, BL] (float32) atau None.
    """
    h, w = image.shape[:2]

    # ── Strategi 1: segmentasi warna petak gelap (papan vinyl) ──
    try:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        # Petak gelap papan vinyl: hijau (H 35-120) ATAU coklat (H 5-30),
        # saturasi cukup tinggi agar meja/kertas putih tidak ikut.
        m1 = cv2.inRange(hsv, (35, 70, 40), (120, 255, 255))
        m2 = cv2.inRange(hsv, (5, 60, 40), (30, 255, 200))
        mask = cv2.bitwise_or(m1, m2)
        k_close = max(31, int(min(h, w) * 0.09) | 1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((k_close, k_close), np.uint8))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((31, 31), np.uint8))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            c = max(contours, key=cv2.contourArea)
            if cv2.contourArea(c) > h * w * 0.10:
                (rcx, rcy), (rw, rh), ang = cv2.minAreaRect(c)
                long_side = max(rw, rh)
                short_side = min(rw, rh)
                if long_side >= min(h, w) * 0.35 and 0.7 <= long_side / max(short_side, 1) <= 1.9:
                    # Blob mencakup seluruh sisi panjang papan (file/rank dengan
                    # petak gelap di kedua ujung). Sisi pendek sering KEKURANGAN
                    # (bidak memutus petak gelap baris tepi) — rekonstruksi
                    # papan persegi penuh dengan meng-extend sisi pendek,
                    # menjaga tepi sisi panjang tetap.
                    rad = math.radians(ang)
                    ux, uy = math.cos(rad), math.sin(rad)      # sumbu panjang
                    sx, sy = -math.sin(rad), math.cos(rad)     # sumbu pendek
                    if sy < 0:
                        sx, sy = -sx, -sy
                    shift = (long_side - short_side) / 2.0
                    cx_new, cy_new = rcx + sx * shift, rcy + sy * shift
                    quad = cv2.boxPoints(((cx_new, cy_new), (long_side, long_side), ang))
                    quad = order_corner_points(quad)
                    # Validasi: quad harus hampir persegi & dalam batas gambar
                    tol = 0.10
                    within = (
                        quad[:, 0].min() >= -w * tol and quad[:, 0].max() <= w * (1 + tol)
                        and quad[:, 1].min() >= -h * tol and quad[:, 1].max() <= h * (1 + tol)
                    )
                    if within:
                        return quad
                    logger.warning("Quad HSV ditolak (di luar batas) — fallback Canny.")
    except Exception as e:
        logger.warning("Segmentasi warna gagal: %s", e)

    # ── Strategi 2 (fallback): OMR-Scanner Canny → quad terbesar ──
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    image_area = h * w
    best, best_area = None, 0
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:12]:
        area = cv2.contourArea(c)
        if area < image_area * 0.15:
            break
        for eps in (0.02, 0.03, 0.05, 0.08):
            approx = cv2.approxPolyDP(c, eps * cv2.arcLength(c, True), True)
            if len(approx) == 4 and cv2.isContourConvex(approx):
                pts = order_corner_points(approx.reshape(4, 2))
                side = float(np.linalg.norm(pts[1] - pts[0]))
                if area > best_area and side > min(h, w) * 0.4:
                    best, best_area = pts, area
                break
    return best


# ─────────────────────────────────────────────────────────────────────────
# Kalibrasi grid 8x8
# ─────────────────────────────────────────────────────────────────────────

_PARITY = np.add.outer(np.arange(8), np.arange(8)) % 2  # 0 = sel (r,c) genap
# Template checkerboard: +1 petak genap, -1 petak ganjil (sudah mean-centered).
_TPL = (2.0 * _PARITY - 1.0)
_TPL_C = _TPL - _TPL.mean()
_TPL_NORM = float(np.sqrt((_TPL_C ** 2).sum()))


def _cell_brightness(g: np.ndarray, x0: float, y0: float, sq: float):
    """Kecerahan median inner-60% tiap petak; None bila keluar batas gambar."""
    gh, gw = g.shape
    m = sq * 0.2
    bright = np.zeros((8, 8), dtype=np.float32)
    for r in range(8):
        ya = int(round(y0 + r * sq + m))
        yb = int(round(y0 + (r + 1) * sq - m))
        if ya < 0 or yb > gh or yb - ya < 2:
            return None
        for c in range(8):
            xa = int(round(x0 + c * sq + m))
            xb = int(round(x0 + (c + 1) * sq - m))
            if xa < 0 or xb > gw or xb - xa < 2:
                return None
            bright[r, c] = np.median(g[ya:yb, xa:xb])
    return bright


def _checker_score(bright: np.ndarray) -> float:
    """Skor kualitas checkerboard dari grid kecerahan 8x8: korelasi Pearson
    terhadap template checkerboard. Invarian terhadap skala & shift kecerahan
    (threshold mean berbasis kontras terbukti rapuh — nilai antara 155-165
    meruntuhkan match). Tanda negatif = petak genap gelap (orientasi standar
    a8 gelap); kedua tanda diterima karena foto dari sisi Hitam ditangani
    lewat rotasi 180° terpisah."""
    bc = bright - bright.mean()
    denom = float(np.sqrt((bc ** 2).sum())) * _TPL_NORM
    if denom < 1e-9:
        return 0.0
    return abs(float((bc * _TPL_C).sum()) / denom)


def calibrate_grid(img: np.ndarray):
    """
    Cari area 64 petak sesungguhnya di dalam gambar (warp ATAU mentah).
    Return (x0, y0, sq) dalam piksel gambar penuh, atau None.

    Pencarian coarse-to-fine pada gambar downscale ~380px lalu refine pada
    gambar penuh. Ukuran petak kandidat meliputi papan KECIL dari gambar
    (screenshot dgn margin) maupun LEBAR BESAR dari gambar (warp dgn label).
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)

    # ── Coarse: downscale ──
    scale = 380.0 / max(h, w)
    g = cv2.resize(gray, (max(8, int(round(w * scale))), max(8, int(round(h * scale)))),
                   interpolation=cv2.INTER_AREA)
    gh, gw = g.shape
    base = min(gh, gw) / 8.0
    best, best_score = None, -1.0
    # sq: papan bisa JAUH lebih kecil dari gambar (screenshot dgn margin hitam
    # lebar, papan cuma ±40% gambar) maupun lebih besar (warp dgn label tepi).
    for sq in np.linspace(base * 0.35, base * 1.3, 20):
        lo = -(8 * sq - min(gh, gw)) - sq * 0.25
        hi = (max(gh, gw) - 8 * sq) + sq * 0.25
        if hi < lo:
            continue
        for x0 in np.linspace(lo, hi, 13):
            for y0 in np.linspace(lo, hi, 13):
                b = _cell_brightness(g, x0, y0, sq)
                if b is None:
                    continue
                sc = _checker_score(b)
                if sc > best_score:
                    best_score, best = sc, (x0, y0, sq)
    if best is None or best_score < 0.4:
        return None

    # ── Fine 1: refine pada downscale ──
    x0, y0, sq = best
    for _ in range(2):
        improved = False
        for ds in (-1.5, -0.75, 0, 0.75, 1.5):
            for dx in (-1.5, -0.75, 0, 0.75, 1.5):
                for dy in (-1.5, -0.75, 0, 0.75, 1.5):
                    if ds == dx == dy == 0:
                        continue
                    b = _cell_brightness(g, x0 + dx, y0 + dy, sq + ds)
                    if b is None:
                        continue
                    sc = _checker_score(b)
                    if sc > best_score:
                        best_score, (x0, y0, sq), improved = sc, (x0 + dx, y0 + dy, sq + ds), True
        if not improved:
            break

    # ── Fine 2: refine presisi pada gambar penuh ──
    X0, Y0, SQ = x0 / scale, y0 / scale, sq / scale
    for _ in range(2):
        improved = False
        for ds in (-1.2, -0.6, 0, 0.6, 1.2):
            for dx in (-1.2, -0.6, 0, 0.6, 1.2):
                for dy in (-1.2, -0.6, 0, 0.6, 1.2):
                    if ds == dx == dy == 0:
                        continue
                    b = _cell_brightness(gray, X0 + dx, Y0 + dy, SQ + ds)
                    if b is None:
                        continue
                    sc = _checker_score(b)
                    if sc > best_score:
                        best_score, (X0, Y0, SQ), improved = sc, (X0 + dx, Y0 + dy, SQ + ds), True
        if not improved:
            break

    logger.info("Kalibrasi grid: (x0=%.1f, y0=%.1f, sq=%.1f) skor=%.3f", X0, Y0, SQ, best_score)
    return (X0, Y0, SQ, best_score)


def detect_pieces(img_np: np.ndarray, conf_override: float | None = None):
    """Jalankan YOLOv11, kembalikan daftar (kelas_fen, cx, cy, conf)."""
    model = load_model()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model YOLOv11 belum tersedia. Jalankan docker compose up -d --build.",
        )
    results = model.predict(img_np, conf=conf_override or CONF_THRESHOLD, verbose=False)
    detections = []
    for r in results:
        names = r.names
        for box in r.boxes:
            fen_char = CLASS_TO_FEN.get(names[int(box.cls[0])])
            if fen_char is None:
                continue
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append((fen_char, (x1 + x2) / 2.0, (y1 + y2) / 2.0, float(box.conf[0])))
    return detections


def grid_fen(detections, grid) -> str:
    """Peta deteksi ke grid terkalibrasi (x0, y0, sq) dan susun board FEN.
    Dedup per petak: ambil deteksi dengan confidence tertinggi."""
    x0, y0, sq = grid[0], grid[1], grid[2]
    board = [[""] * 8 for _ in range(8)]
    best_conf = [[0.0] * 8 for _ in range(8)]
    for fen_char, cx, cy, conf in detections:
        col = int((cx - x0) / sq)
        row = int((cy - y0) / sq)
        if col < 0 or col > 7 or row < 0 or row > 7:
            continue  # di luar papan terkalibrasi (mis. bidak cadangan)
        if conf > best_conf[row][col]:
            best_conf[row][col] = conf
            board[row][col] = fen_char

    ranks = []
    for row in board:
        fen_rank, empty = "", 0
        for sq_char in row:
            if sq_char == "":
                empty += 1
            else:
                if empty > 0:
                    fen_rank += str(empty)
                    empty = 0
                fen_rank += sq_char
        if empty > 0:
            fen_rank += str(empty)
        ranks.append(fen_rank)
    return "/".join(ranks)


def rotate180_board(board_fen: str) -> str:
    """Rotasi papan 180° (foto dari sisi Hitam: baris & kolom dibalik)."""
    ranks = board_fen.split("/")
    grid = []
    for rank in ranks:
        row = []
        for ch in rank:
            if ch.isdigit():
                row.extend([""] * int(ch))
            else:
                row.append(ch)
        grid.append(row)
    grid = [list(reversed(r)) for r in reversed(grid)]
    out = []
    for row in grid:
        fen, empty = "", 0
        for sqc in row:
            if sqc == "":
                empty += 1
            else:
                if empty:
                    fen += str(empty)
                    empty = 0
                fen += sqc
        if empty:
            fen += str(empty)
        out.append(fen)
    return "/".join(out)


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
        for sqc, piece in board.piece_map().items():
            if piece.piece_type == chess.PAWN and chess.square_rank(sqc) in (0, 7):
                return False
        return True
    except Exception:
        return False


def piece_count(board_fen: str) -> int:
    return sum(1 for ch in board_fen if ch.isalpha())


# ─────────────────────────────────────────────────────────────────────────
# Engine papan DIGITAL (screenshot lichess/chess.com)
# ─────────────────────────────────────────────────────────────────────────
# Model YOLO dilatih pada foto bidak FISIK dan tidak mengenali glif bidak 2D
# pada screenshot (terukur: 0-4 deteksi dari 20+ bidak). Untuk screenshot,
# pembacaan per-petak deterministik jauh lebih akurat: petak terisi = piksel
# yang menyimpang jauh dari warna dasar petak; jenis bidak = kecocokan siluet
# dengan glyph catur (DejaVu); warna = dominasi piksel gelap vs terang.

_PIECE_TPL_DIRS = (
    os.environ.get("PIECE_TEMPLATES", "/app/pieces"),
    "/app/pieces_staunty",
    "/app/pieces_chessnut",
    "/tmp/pieces_png",
    "/tmp/pieces_staunty",
    "/tmp/pieces_chessnut",
)
_PIECE_TPL = None


def _load_piece_templates():
    """Muat template bidak PNG (BGR + alpha) dari semua set tersedia.
    Dipakai sebagai komposit berwarna di atas warna dasar petak."""
    global _PIECE_TPL
    if _PIECE_TPL is not None:
        return _PIECE_TPL
    out = {}
    for d in _PIECE_TPL_DIRS:
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith(".png") or len(fn) < 5:
                continue
            rgba = cv2.imread(os.path.join(d, fn), cv2.IMREAD_UNCHANGED)
            if rgba is None or rgba.ndim != 3 or rgba.shape[2] < 4:
                continue
            if rgba.shape[0] != 96 or rgba.shape[1] != 96:
                rgba = cv2.resize(rgba, (96, 96), interpolation=cv2.INTER_AREA)
            # Tight-crop ke bbox alpha: crop petak juga ketat (bbox mask),
            # keduanya harus mulai dari tepi glif agar sejajar saat squash.
            ys, xs = np.where(rgba[:, :, 3] > 40)
            if len(ys) == 0:
                continue
            rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            bgr = rgba[:, :, :3].astype(np.float32)
            alpha = (rgba[:, :, 3].astype(np.float32) / 255.0)[..., None]
            out[fn[:-4]] = (bgr, alpha)
    logger.info("Template bidak dimuat: %s", sorted(out) if out else "TIDAK ADA")
    _PIECE_TPL = out
    return out


_SIL_ENSEMBLE = None


def _load_sil_ensemble(cls: int = 48):
    """Ensemble siluet: satu dict template per set direktori (tiap dict
    12 entry wK/bK/..., letterbox CLS). Return list of dict."""
    global _SIL_ENSEMBLE
    if _SIL_ENSEMBLE is not None:
        return _SIL_ENSEMBLE
    ens = []
    for d in _PIECE_TPL_DIRS:
        if not os.path.isdir(d):
            continue
        tpls = {}
        for fn in sorted(os.listdir(d)):
            if not fn.lower().endswith(".png") or len(fn) < 5:
                continue
            rgba = cv2.imread(os.path.join(d, fn), cv2.IMREAD_UNCHANGED)
            if rgba is None or rgba.ndim != 3 or rgba.shape[2] < 4:
                continue
            if rgba.shape[0] != 96 or rgba.shape[1] != 96:
                rgba = cv2.resize(rgba, (96, 96), interpolation=cv2.INTER_AREA)
            ys, xs = np.where(rgba[:, :, 3] > 40)
            if len(ys) == 0:
                continue
            a = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1, 3]
            tpls[fn[:-4]] = _letterbox(a.astype(np.float32) / 255.0, cls)
        if len(tpls) == 12:
            ens.append(tpls)
    logger.info("Ensemble siluet: %d set template", len(ens))
    _SIL_ENSEMBLE = ens
    return ens
_SIL_ENSEMBLE = None




def _ring_color(cell: np.ndarray) -> np.ndarray:
    """Warna dasar petak: median pita tepi petak (bidak tidak menyentuh tepi,
    jadi pita tepi murni warna petak — aman untuk petak yang disorot)."""
    ch, cw = cell.shape[:2]
    t = max(1, int(min(ch, cw) * 0.12))
    band = np.concatenate([
        cell[:t].reshape(-1, 3), cell[-t:].reshape(-1, 3),
        cell[:, :t].reshape(-1, 3), cell[:, -t:].reshape(-1, 3),
    ])
    return np.median(band, axis=0).astype(np.float32)


def _checker_grid_score(fimg: np.ndarray, x0: float, y0: float, sq: float) -> float:
    """Kontras selang-seling median warna PITA RING petak (12% tepi).
    Pita ring murni warna petak — tak terpengaruh bidak yang menutupi
    tengah petak dan membiaskan kontras checkerboard."""
    H, W = fimg.shape[:2]
    b = np.zeros((8, 8), np.float32)
    for r in range(8):
        for c in range(8):
            xa = int(round(x0 + c * sq))
            xb = int(round(x0 + (c + 1) * sq))
            ya = int(round(y0 + r * sq))
            yb = int(round(y0 + (r + 1) * sq))
            if xa < 0 or ya < 0 or xb > W or yb > H or xb - xa < 8 or yb - ya < 8:
                return -1e9
            cell = fimg[ya:yb, xa:xb]
            tt = max(1, int(min(cell.shape[:2]) * 0.12))
            band = np.concatenate([
                cell[:tt].ravel(), cell[-tt:].ravel(),
                cell[:, :tt].ravel(), cell[:, -tt:].ravel(),
            ])
            b[r, c] = float(np.median(band))
    dh = np.abs(b[:, :-1] - b[:, 1:]).mean()
    dv = np.abs(b[:-1, :] - b[1:, :]).mean()
    return float(dh + dv)


def _refine_checker_grid(fimg: np.ndarray, x0: float, y0: float, sq: float):
    """Perbaiki (x0, y0, sq) hasil kmeans dgn memaksimalkan kontras
    selang-seling kecerahan antar petak (skor checkerboard ring petak).
    Blob kmeans sering melebar ke frame kayu/label yang warnanya mirip
    petak (t8) — wilayah seragam memberi kontras 0 sehingga terdorong keluar.
    """
    best = (x0, y0, sq)
    best_s = _checker_grid_score(fimg, x0, y0, sq)
    # Tidak ada early-return: bila grid awal OOB (skor -1e9), kandidat valid
    # pertama harus tetap bisa menang.
    for sqv in np.linspace(sq * 0.9, sq * 1.1, 11):
        for dx in np.linspace(-0.35 * sq, 0.35 * sq, 8):
            for dy in np.linspace(-0.35 * sq, 0.35 * sq, 8):
                s = _checker_grid_score(fimg, x0 + dx, y0 + dy, sqv)
                if s > best_s:
                    best_s = s
                    best = (x0 + dx, y0 + dy, float(sqv))
    return best


def detect_digital_board_bbox(img: np.ndarray, return_colors: bool = False):
    """
    Deteksi bbox papan DIGITAL (screenshot lichess/chess.com) via 2 warna
    petak dominan: kuantisasi warna -> dua warna terbanyak = petak terang &
    gelap -> mask -> bounding rect blob terbesar.
    Return (x0, y0, sq) dalam piksel gambar penuh (sq = ukuran petak),
    atau (x0, y0, sq, colors) bila return_colors.
    """
    h, w = img.shape[:2]
    scale = 300.0 / max(h, w)
    small = cv2.resize(img, (max(8, int(round(w * scale))), max(8, int(round(h * scale)))),
                       interpolation=cv2.INTER_AREA)
    sh, sw = small.shape[:2]
    Z = small.reshape(-1, 3).astype(np.float32)
    # Kuantisasi ke 5 warna; dua terbanyak = warna petak (papan mendominasi
    # screenshot; UI di sekitar biasanya lebih gelap/beragam).
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(Z, 5, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    labels = labels.ravel()
    counts = np.bincount(labels, minlength=5)
    order = np.argsort(counts)[::-1]
    if len(order) < 2:
        return None
    c1, c2 = centers[order[0]], centers[order[1]]
    # Dua warna teratas harus cukup berbeda (bukan duplikat klaster)
    if float(np.linalg.norm(c1 - c2)) < 25.0:
        c2 = centers[order[2]] if len(order) > 2 else None
        if c2 is None or float(np.linalg.norm(c1 - c2)) < 25.0:
            return None
    d1 = np.linalg.norm(Z - c1, axis=1)
    d2 = np.linalg.norm(Z - c2, axis=1)
    mask = ((np.minimum(d1, d2) < 32.0).astype(np.uint8)).reshape(sh, sw)
    k = max(3, int(sw * 0.04) | 1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    if cv2.contourArea(c) < sh * sw * 0.12:
        return None
    bx, by, bw, bh = cv2.boundingRect(c)
    # Papan persegi; blob bisa sedikit non-persegi — ambil rata-rata.
    side = (bw + bh) / 2.0
    cx, cy = bx + bw / 2.0, by + bh / 2.0
    x0f, y0f = cx - side / 2.0, cy - side / 2.0
    # Skala balik ke resolusi penuh; sq = UKURAN PETAK (bukan sisi papan)
    inv = 1.0 / scale
    result = (x0f * inv, y0f * inv, side * inv / 8.0)
    # Refinement: maksimalkan kontras checkerboard ring petak di sekitar
    # dugaan kmeans. Diterima hanya bila skor naik >8% (kmeans sering sudah
    # presisi), ATAU bila skor mentah OOB dan refined valid.
    fimg = img.astype(np.float32)
    s_raw = _checker_grid_score(fimg, *result)
    rx0, ry0, rsq = _refine_checker_grid(fimg, *result)
    s_ref = _checker_grid_score(fimg, rx0, ry0, rsq)
    take_ref = ((s_raw > 0 and s_ref > 1.08 * s_raw) or
                (s_raw <= 0 and s_ref > 0))
    if _REFINE_GRID and take_ref:
        result = (rx0, ry0, rsq)
    if return_colors:
        return result + (tuple(c1.astype(float)), tuple(c2.astype(float)))
    return result


_GRAD_CACHE = None
_CELL_DEBUG = None  # bila list, read_digital_board mengisi debug per petak
_REFINE_GRID = True  # flag uji: nonaktifkan refinement grid checkerboard


def _ncc_flat(a: np.ndarray, b: np.ndarray) -> float:
    """Korelasi silang ternormalisasi dua array 2D (mean-centered)."""
    af = a.reshape(-1).astype(np.float32)
    bf = b.reshape(-1).astype(np.float32)
    af -= af.mean()
    bf -= bf.mean()
    d = float(np.sqrt((af ** 2).sum()) * np.sqrt((bf ** 2).sum()))
    return float((af * bf).sum() / d) if d > 1e-9 else 0.0


def _load_grad_templates(cls: int = 48):
    """Template gradien Sobel (magnitude, ternormalisasi) dari glif abu-abu
    di atas background mid-gray — per set template. Gradien menangkap garis
    INTERNAL glif (salib mahkota king vs gerigi queen) yg siluet padat lewatkan."""
    global _GRAD_CACHE
    if _GRAD_CACHE is not None:
        return _GRAD_CACHE
    mid = 170.0  # abu-abu netral; NCC invarian terhadap shift kontras global
    out = []
    for tpls in _load_sil_ensemble(cls):
        # Warna glif per set: ambil dari _load_piece_templates bila ada,
        # fallback abu-abu (glif cburnett: putih + outline hitam).
        color_map = _load_piece_templates()
        d = {}
        for tname, tmpl in tpls.items():
            if tname in color_map:
                bgr, alpha = color_map[tname]
                g = bgr.mean(axis=2) * alpha[..., 0] + mid * (1.0 - alpha[..., 0])
            else:
                g = np.full((96, 96), mid, np.float32)
            gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
            gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
            e = np.sqrt(gx ** 2 + gy ** 2)
            e = e / (e.max() + 1e-6)
            d[tname] = _letterbox(e, cls)
        out.append(d)
    # Gabung SEMUA set: gradien invarian kontras, cocokkan semua varian dan
    # ambil skor max di pemanggil.
    flat = {}
    for d in out:
        for tname, tm in d.items():
            if tname not in flat:
                flat[tname] = [tm]
            else:
                flat[tname].append(tm)
    _GRAD_CACHE = flat
    return flat


def _grad_score(ce_lb, gtmpls, tname: str) -> float:
    """Skor gradien maksimum antar semua set template utk satu jenis."""
    return max(_ncc_flat(ce_lb, tm) for tm in gtmpls[tname])


def _fill_holes(m: np.ndarray) -> np.ndarray:
    """Isi lubang di dalam mask (bidak cburnett hitam: fill abu-abu mirip
    warna petak gelap -> mask bolong seperti donat, merusak siluet)."""
    ff = (m > 0).astype(np.uint8)
    pad = np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8)
    cv2.floodFill(ff, pad, (0, 0), 1)
    return ((m > 0) | (ff == 0)).astype(np.uint8)


def _letterbox(m: np.ndarray, size: int = 48) -> np.ndarray:
    """Resize mask 2D mempertahankan proporsi aspek, letterbox ke size x size."""
    mh, mw = m.shape
    sc = (size - 2) / max(mh, mw)
    nh, nw = max(1, int(round(mh * sc))), max(1, int(round(mw * sc)))
    res = cv2.resize(m, (nw, nh), interpolation=cv2.INTER_AREA)
    canvas = np.zeros((size, size), dtype=m.dtype if m.dtype == np.float32 else np.float32)
    oy, ox = (size - nh) // 2, (size - nw) // 2
    canvas[oy:oy + nh, ox:ox + nw] = res
    return canvas


def _digital_inlier_ratio(img: np.ndarray) -> float:
    """Fraksi piksel yang cocok dgn 2 warna dominan kmeans — ukuran seberapa
    'digital' gambar (screenshot papan = 2 warna flat mendominasi; foto fisik
    = tekstur/pencahayaan bervariasi). Data uji: screenshot 0.67-0.83,
    foto fisik 0.40-0.55."""
    h, w = img.shape[:2]
    scale = 300.0 / max(h, w)
    small = cv2.resize(img, (max(8, int(round(w * scale))), max(8, int(round(h * scale)))),
                       interpolation=cv2.INTER_AREA)
    Z = small.reshape(-1, 3).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    try:
        _, labels, centers = cv2.kmeans(Z, 5, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    except cv2.error:
        return 0.0
    labels = labels.ravel()
    counts = np.bincount(labels, minlength=5)
    order = np.argsort(counts)[::-1]
    c1, c2 = centers[order[0]], centers[order[1]]
    d1 = np.linalg.norm(Z - c1, axis=1)
    d2 = np.linalg.norm(Z - c2, axis=1)
    return float((np.minimum(d1, d2) < 32.0).mean())


def _digital_candidates(img: np.ndarray) -> list[str]:
    """Baca papan digital dengan beberapa varian grid & pilih nanti.
    Grid kmeans mentah vs hasil refinement checkerboard masing-masing
    unggul di screenshot berbeda (refinement memperbaiki t3/t6/t8 tapi
    merusak t7; sebaliknya kmeans mentah presisi di t7 tapi meleset di t8).
    Foto fisik (inlier ratio rendah) langsung dilewati — pembaca digital
    menghasilkan sampah di foto fisik dengan perspektif & pencahayaan."""
    global _REFINE_GRID
    if _digital_inlier_ratio(img) < 0.62:
        return []
    fens = []
    for ref in (False, True):
        _REFINE_GRID = ref
        try:
            f = read_digital_board(img, calib=None)
        except Exception:
            f = None
        finally:
            _REFINE_GRID = True
        if f and f not in fens:
            fens.append(f)
    return fens


def read_digital_board(img: np.ndarray, calib=None) -> str | None:
    """Baca papan digital (screenshot lichess/chess.com) per-petak.
    Return board FEN atau None.

    1. Grid papan: kalibrasi checkerboard (korelasi selang-seling, presisi
       tinggi) — fallback bbox kmeans 2 warna dominan.
    2. Per petak: composite template cburnett berwarna (putih & hitam) di atas
       warna dasar petak, cocokkan via NCC dengan pencarian posisi sub-petak.
       Skor tertinggi menentukan jenis + WARNA sekaligus, dan sekaligus
       menjadi occupancy (skor rendah = petak kosong). Ini memanfaatkan
       struktur fill+outline glif 2D — siluet saja terbukti tidak diskriminatif
       (rook vs king vs bishop saling kepleset).
    """
    tpls = _load_piece_templates()
    if not tpls:
        return None
    if calib is None:
        # Untuk screenshot digital: bbox kmeans 2 warna petak lebih konsisten
        # daripada checkerboard correlation — papan digital punya variasi warna
        # dalam-petak (tekstur kayu, gradient) yg menipu skor checkerboard
        # (calibrate_grid t4 menggeser grid turun 1/3 petak, memotong baris
        # atas; bbox kmeans terbukti presisi di overlay visual).
        calib = detect_digital_board_bbox(img)
    if calib is None:
        calib = calibrate_grid(img)
    if calib is None:
        return None
    x0, y0, sq = float(calib[0]), float(calib[1]), float(calib[2])
    H, W = img.shape[:2]
    fimg = img.astype(np.float32)

    def cell_rect(r, c):
        m = sq * 0.06
        xa, xb = int(round(x0 + c * sq + m)), int(round(x0 + (c + 1) * sq - m))
        ya, yb = int(round(y0 + r * sq + m)), int(round(y0 + (r + 1) * sq - m))
        xa, ya = max(0, xa), max(0, ya)
        xb, yb = min(W, xb), min(H, yb)
        return xa, ya, xb, yb

    # Warna dasar GLOBAL papan (utk komposit template): median pita tepi
    # semua petak, diurutkan kecerahan -> setengah gelap & setengah terang.
    ring_colors = []
    for r in range(8):
        for c in range(8):
            xa, ya, xb, yb = cell_rect(r, c)
            if xb - xa < 6 or yb - ya < 6:
                continue
            rc = _ring_color(fimg[ya:yb, xa:xb])
            ring_colors.append(rc)
    if len(ring_colors) < 40:
        return None
    ring_colors.sort(key=lambda v: float(np.mean(v)))
    half = len(ring_colors) // 2
    dark_base = np.median(np.array(ring_colors[:half]), axis=0).astype(np.float32)
    light_base = np.median(np.array(ring_colors[half:]), axis=0).astype(np.float32)
    dark_gray = float(np.mean(dark_base))
    light_gray = float(np.mean(light_base))
    if light_gray - dark_gray < 15.0:
        return None

    CLS = 48  # ukuran klasifikasi (crop & template sama-sama di-letterbox)
    # ENSEMBLE 3 set template (cburnett/staunty/chessnut): skor bidak = max
    # antar set. T7 (cburnett): staunty unggul utk bishop/knight, cburnett
    # utk king; ensemble 19/21 benar vs 6-9 per set individual.
    ens = _load_sil_ensemble(CLS)
    if not ens:
        return None

    # Pass 1: skor semua 12 jenis x 2 kandidat mask utk tiap petak.
    cell_preds = [[None] * 8 for _ in range(8)]  # (fen_char, skor)
    cell_mask = [[None] * 8 for _ in range(8)]
    for r in range(8):
        for c in range(8):
            xa, ya, xb, yb = cell_rect(r, c)
            if xb - xa < 24 or yb - ya < 24:
                continue
            cellf = fimg[ya:yb, xa:xb]
            # (a) Occupancy: piksel yang jauh dari warna pita tepi petak ITU
            # SENDIRI (bukan median global — tekstur kayu chess.com bervariasi
            # per posisi dan median global memicu false positive masif; data
            # debug t4: frac per petak match 100% dgn posisi bidak visual).
            # Pita tepi tak tersentuh bidak & tetap benar pada petak disorot.
            ring = _ring_color(cellf)
            flat = cellf.reshape(-1, 3)
            dist = np.linalg.norm(flat - ring, axis=1)
            pmask = (dist > 55.0).reshape(cellf.shape[:2]).astype(np.uint8)
            # Nol-kan bingkai tepi window (artifak ringing JPEG antar petak).
            pmask[:4, :] = 0; pmask[-4:, :] = 0
            pmask[:, :4] = 0; pmask[:, -4:] = 0
            nlab, lab, stats, _ = cv2.connectedComponentsWithStats(pmask, connectivity=8)
            if nlab <= 1:
                continue
            # Buang komponen yang MENYENTUH tepi window — bingkai ringing JPEG.
            # KECUALI sisi yang berbatasan langsung dengan tepi PAPAN (baris 0,
            # baris 7, kolom 0/7): bidak di rank 1/8 sering menyentuh batas
            # papan dan justru harus dipertahankan (raja e8 t7 tadinya hilang).
            gh_c, gw_c = pmask.shape
            keep = np.zeros_like(pmask)
            keep_alt = np.zeros_like(pmask)
            for lab_i in range(1, nlab):
                x1, y1, bw1, bh1, a1 = (stats[lab_i, cv2.CC_STAT_LEFT],
                                        stats[lab_i, cv2.CC_STAT_TOP],
                                        stats[lab_i, cv2.CC_STAT_WIDTH],
                                        stats[lab_i, cv2.CC_STAT_HEIGHT],
                                        stats[lab_i, cv2.CC_STAT_AREA])
                touches = ((x1 <= 1 and c > 0) or
                           (y1 <= 1 and r > 0) or
                           (x1 + bw1 >= gw_c - 1 and c < 7) or
                           (y1 + bh1 >= gh_c - 1 and r < 7))
                if touches:
                    continue
                if a1 >= 0.02 * pmask.size:
                    keep[lab == lab_i] = 1
                keep_alt[lab == lab_i] = 1  # SEMUA komponen non-tepi
            keep = _fill_holes(keep)
            keep_alt = _fill_holes(keep_alt)
            if keep.sum() < 0.10 * pmask.size:
                continue
            # (b) Klasifikasi: 2 kandidat mask x 12 template x semua set — NCC.
            cand_crops = []
            for km in (keep, keep_alt):
                ys, xs = np.where(km > 0)
                if len(ys) == 0:
                    continue
                mc = km[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32)
                if mc.shape[0] < 8 or mc.shape[1] < 8:
                    continue
                clb = _letterbox(np.clip(mc, 0, 1), CLS)
                cand_crops.append((clb, float(np.sqrt((clb ** 2).sum())) or 1.0))
            if not cand_crops:
                continue
            best_t, best_s = None, -1.0
            k_score = -1.0  # skor siluet terbaik template KING (utk resolusi global)
            kind_scores = {}  # tname -> skor siluet terbaik per jenis
            for tpls_s in ens:
                for tname, tmpl in tpls_s.items():
                    tn = float(np.sqrt((tmpl ** 2).sum())) or 1.0
                    for clb, cn in cand_crops:
                        s = float((clb * tmpl).sum() / (cn * tn))
                        if s > kind_scores.get(tname, -1.0):
                            kind_scores[tname] = s
                        if tname[1] == "K" and s > k_score:
                            k_score = s
                        if s > best_s:
                            best_s, best_t = s, tname
            if best_t is None or best_s < 0.55:
                continue
            # (c) Warna DULU: fraksi piksel mask yang LEBIH TERANG dari mid
            # dua warna petak (putih >>0.3, hitam ~0).
            cellg = cv2.cvtColor(cellf, cv2.COLOR_BGR2GRAY)
            bright_frac = float((cellg[keep_alt > 0] > (dark_gray + light_gray) / 2.0).mean())
            is_black = bright_frac < 0.25
            # (b2) Diskriminator KING vs QUEEN — siluet K/Q saling kepleset.
            # Data t7 g8: siluet sudah benar (bK 0.902 > bQ 0.840) sedangkan
            # NCC gradien SALAH (bQ 0.154 > bK 0.100, fill king chessnut
            # lebar mirip queen). Gradien hanya dipakai sbg tie-breaker
            # bila siluet K/Q hampir seri (margin < 0.03).
            if best_t[1] in ("K", "Q"):
                pref = "b" if is_black else "w"
                sK = kind_scores.get(pref + "K", -1.0)
                sQ = kind_scores.get(pref + "Q", -1.0)
                if abs(sK - sQ) < 0.03:
                    gtmpls = _load_grad_templates(CLS)
                    ys3, xs3 = np.where(keep_alt > 0)
                    if len(ys3) > 0:
                        cg = cv2.cvtColor(
                            cellf[ys3.min():ys3.max() + 1, xs3.min():xs3.max() + 1],
                            cv2.COLOR_BGR2GRAY,
                        ).astype(np.float32)
                        gx = cv2.Sobel(cg, cv2.CV_32F, 1, 0, ksize=3)
                        gy = cv2.Sobel(cg, cv2.CV_32F, 0, 1, ksize=3)
                        ce = np.sqrt(gx ** 2 + gy ** 2)
                        ce = ce / (ce.max() + 1e-6)
                        ce_lb = _letterbox(ce, CLS)
                        gK = _grad_score(ce_lb, gtmpls, pref + "K")
                        gQ = _grad_score(ce_lb, gtmpls, pref + "Q")
                        best_t = (pref + "K") if gK >= gQ else (pref + "Q")
                    else:
                        best_t = (pref + "K") if sK >= sQ else (pref + "Q")
                else:
                    best_t = (pref + "K") if sK > sQ else (pref + "Q")
            kind = best_t[1]
            if kind == "P" and r in (0, 7):
                continue
            ch = kind if bright_frac >= 0.25 else kind.lower()
            cell_preds[r][c] = (ch, best_s, k_score)
            cell_mask[r][c] = keep_alt
            if _CELL_DEBUG is not None:
                _CELL_DEBUG.append({
                    "r": r, "c": c, "ch": ch, "s": best_s,
                    "keep_frac": float(keep_alt.sum()) / pmask.size,
                    "keep": int(keep_alt.sum()),
                    "bright": bright_frac,
                })

    # Pass 2: konsistensi global — raja TUNGGAL per warna.
    #   >1 raja  -> pertahankan skor tertinggi, sisanya ganti kandidat non-king.
    #   0 raja   -> petak dgn k-score siluet king tertinggi dipromosikan jadi
    #               raja (siluet king chessnut/queen saling kepleset).
    def fix_kings(is_black: bool):
        king = "k" if is_black else "K"
        spots = [(cell_preds[r][c][1], r, c)
                 for r in range(8) for c in range(8)
                 if cell_preds[r][c] and cell_preds[r][c][0] == king]
        if len(spots) > 1:
            spots.sort(reverse=True)  # skor tertinggi dipertahankan
            to_fix = [(rr, cc) for _, rr, cc in spots[1:]]
        elif len(spots) == 1:
            return
        else:
            # 0 raja: promosi petak dgn k-score tertinggi.
            kcands = [(cell_preds[r][c][2], r, c)
                      for r in range(8) for c in range(8)
                      if cell_preds[r][c] and cell_preds[r][c][2] > 0]
            if not kcands:
                return
            kcands.sort(reverse=True)
            r, c = kcands[0][1], kcands[0][2]
            cell_preds[r][c] = (king, cell_preds[r][c][1], cell_preds[r][c][2])
            return
        for r, c in to_fix:
            # Cari kandidat non-king terbaik utk petak ini (skor per set).
            km = cell_mask[r][c]
            ys, xs = np.where(km > 0)
            mc = km[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32)
            clb = _letterbox(np.clip(mc, 0, 1), CLS)
            cn = float(np.sqrt((clb ** 2).sum())) or 1.0
            alt_t, alt_s = None, -1.0
            for tpls_s in ens:
                for tname, tmpl in tpls_s.items():
                    if tname[1] == "K":
                        continue
                    tn = float(np.sqrt((tmpl ** 2).sum())) or 1.0
                    s = float((clb * tmpl).sum() / (cn * tn))
                    if s > alt_s:
                        alt_s, alt_t = s, tname
            if alt_t is None:
                cell_preds[r][c] = None
                continue
            cellg_col = cell_mask[r][c]
            # Warna ulang dari mask: hitung ulang dari petak asli.
            xa, ya, xb, yb = cell_rect(r, c)
            cellf_c = fimg[ya:yb, xa:xb]
            cellg_c = cv2.cvtColor(cellf_c, cv2.COLOR_BGR2GRAY)
            bf = float((cellg_c[cellg_col > 0] > (dark_gray + light_gray) / 2.0).mean())
            kind = alt_t[1]
            ch = kind if bf >= 0.25 else kind.lower()
            cell_preds[r][c] = (ch, alt_s, cell_preds[r][c][2])

    fix_kings(True)
    fix_kings(False)

    total = 0
    ranks = []
    for r in range(8):
        row = []
        for c in range(8):
            p = cell_preds[r][c]
            if p is None:
                row.append("")
            else:
                row.append(p[0])
                total += 1
        ranks.append(row)
    if total < 2:
        return None
    out = []
    for row in ranks:
        fen, empty = "", 0
        for sqc in row:
            if sqc == "":
                empty += 1
            else:
                if empty:
                    fen += str(empty)
                    empty = 0
                fen += sqc
        if empty:
            fen += str(empty)
        out.append(fen)
    return "/".join(out)


@app.get("/health")
def health():
    model = load_model()
    return {
        "status": "ok",
        "service": "yolo11-chess",
        "model_loaded": model is not None,
        "model_path": MODEL_PATH,
    }


@app.post("/corners")
def corners(req: CornersRequest):
    """Deteksi 4 sudut papan + gambar debug overlay (untuk modal crop)."""
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


@app.post("/predict")
def predict(req: ScanRequest):
    try:
        img = decode_image(req.image)

        # 1. Auto-crop (bukan prewarped): deteksi sudut & warp ke 800x800.
        warped = None
        if req.autoCrop and not req.prewarped:
            pts = detect_board_corners(img)
            if pts is not None:
                warped = four_point_transform(img, pts, size=800)
                logger.info("Auto-crop papan berhasil.")

        # 2. Kalibrasi grid — STRATEGI:
        #    a) Langsung di foto MENTAH dulu. Screenshot ( mayoritas kasus)
        #       papan sudah sejajar-sumbu tanpa distorsi perspektif; warp malah
        #       berisiko memotong sebagian papan bila quad Canny meleset.
        #    b) Bila gagal / skor lebih rendah, coba di hasil warp.
        #    Pilih kandidat dengan skor checkerboard tertinggi.
        calib = None
        work_img = img
        cal_raw = calibrate_grid(img)
        if req.autoCrop and not req.prewarped:
            pts = detect_board_corners(img)
            if pts is not None:
                warped = four_point_transform(img, pts, size=800)
                cal_warp = calibrate_grid(warped)
                if cal_warp is not None and (cal_raw is None or cal_warp[3] > cal_raw[3]):
                    calib, work_img = cal_warp, warped
                    logger.info("Memakai kalibrasi WARP (skor %.2f > %.2f)",
                                cal_warp[3], cal_raw[3] if cal_raw else -1)
        if calib is None and cal_raw is not None:
            calib = cal_raw
            logger.info("Memakai kalibrasi FOTO MENTAH (skor %.2f)", cal_raw[3])
        if calib is None:
            # Fallback terakhir: asumsikan papan memenuhi gambar.
            if warped is not None:
                work_img = warped
            else:
                work_img = img
            calib = (0.0, 0.0, work_img.shape[1] / 8.0, 0.0)
            logger.warning("Kalibrasi grid gagal — fallback grid penuh.")

        h, w = work_img.shape[:2]

        # 3. Threshold adaptif dua tahap.
        result = None
        used_conf = CONF_THRESHOLD
        first_candidate = None
        for conf_try in (CONF_THRESHOLD, 0.15, 0.08):
            dets = detect_pieces(work_img, conf_override=conf_try)
            cand = grid_fen(dets, calib)
            if first_candidate is None or piece_count(cand) > piece_count(first_candidate):
                if first_candidate is None:
                    first_candidate = cand
            # 4. Orientasi: coba apa adanya (foto dari sisi Putih) lalu rotasi
            #    180° (foto dari sisi Hitam). Ambil yang plausibel.
            for label, bfen in (("normal", cand), ("rot180", rotate180_board(cand))):
                if plausible_board_fen(bfen):
                    result = (bfen, label, conf_try)
                    break
            if result:
                break

        # Fallback papan DIGITAL (screenshot): glif 2D tidak dikenali YOLO.
        # Baca dengan beberapa varian grid (kmeans mentah & refined checker);
        # pilih yang plausibel. Jika keduanya plausibel, ambil yang pertama
        # (urutan di _digital_candidates).
        if result is None:
            try:
                dig_variants = _digital_candidates(img)
                for cand_dig in dig_variants:
                    for label, bfen in (("digital", cand_dig), ("digital-rot180", rotate180_board(cand_dig))):
                        if plausible_board_fen(bfen):
                            result = (bfen, label, 0.0)
                            break
                    if result:
                        break
                if result is None and dig_variants:
                    rot_dig = rotate180_board(dig_variants[0])
                    first_candidate = dig_variants[0] if piece_count(dig_variants[0]) >= piece_count(rot_dig) else rot_dig
            except Exception as e:
                logger.warning("Pembaca papan digital gagal: %s", e)

        if result:
            board_fen, orient, used_conf = result
            engine = "yolo11" if orient.startswith("rot") is False and orient == "normal" else (
                "yolo11" if orient in ("normal", "rot180") else "digital-reader"
            )
            return {
                "ok": True,
                "fen": board_fen + " w - - 0 1",
                "board_fen": board_fen,
                "detections": piece_count(board_fen),
                "engine": engine,
                "orientation": orient,
                "used_conf": used_conf,
            }

        # Tidak plausibel — kirim kandidat terbaik untuk ditinjau user.
        cand = first_candidate or ""
        alt = rotate180_board(cand) if cand else ""
        best_cand = cand if piece_count(cand) >= piece_count(alt) else alt
        return {
            "ok": False,
            "error": "Deteksi menghasilkan posisi yang tidak masuk akal (raja hilang/ganda, pion ilegal, atau bidak berlebih). Perbaiki manual di papan referensi.",
            "board_fen_candidate": best_cand,
            "used_conf": used_conf,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Prediction failure: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
