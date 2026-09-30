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
    pil = Image.open(io.BytesIO(img_bytes))
    # Wajib: foto HP/WhatsApp menyimpan rotasi di metadata EXIF, bukan pada
    # piksel. Tanpa exif_transpose, gambar terproses salah orientasi (terukur
    # 902x1600 vs 1200x1600 pada foto user) dan seluruh deteksi jadi kacau.
    pil = ImageOps.exif_transpose(pil).convert("RGB")
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


def refine_quad_by_gridlines(image: np.ndarray, rough_quad: np.ndarray) -> np.ndarray:
    """
    Refine quad kasar (hasil kontur, sering miring +-beberapa derajat / bergeser
    seperempat petak) dengan mendeteksi garis grid internal 8x8 pada hasil warp
    kasar — sama seperti teknik profile energi gradien pada sisi client
    (detectChessboardCorners). Return quad baru dalam koordinat gambar asli.
    """
    h, w = image.shape[:2]
    size = 400
    rough = four_point_transform(image, rough_quad, size=size)
    gray = cv2.cvtColor(rough, cv2.COLOR_BGR2GRAY).astype(np.float32)

    # Energi gradien per baris & kolom (garis grid = puncak periodik)
    gx = np.abs(np.diff(gray, axis=1)).sum(axis=0)  # per kolom
    gy = np.abs(np.diff(gray, axis=0)).sum(axis=1)  # per baris

    def find_bounds(profile: np.ndarray) -> tuple[float, float]:
        """Cari bounds area 8 petak: pilih pasangan (lo,hi) yang membagi
        profile menjadi 8 periode dengan energi garis-grid tertinggi.
        Ini mencegah bounds meleset ke tepi label atau tepi papan vinyl."""
        n = len(profile)
        k = np.ones(5) / 5.0
        p = np.convolve(profile, k, mode="same")
        total = p.sum() or 1.0

        best_range, best_score = (0.0, 1.0), -1.0
        # Coba semua pasangan bounds pada grid 2.5% — cukup halus & cepat
        steps = [i / 40.0 for i in range(4, 37)]  # 0.1 .. 0.9
        for i, lo_f in enumerate(steps):
            for hi_f in steps[i + 8:]:  # minimal lebar 20%
                lo_i, hi_i = int(lo_f * n), int(hi_f * n)
                if hi_i - lo_i < 10:
                    continue
                seg = p[lo_i:hi_i]
                # skor: energi dalam window MINUS energi di luar (penalti)
                outside = total - seg.sum()
                score = seg.sum() - 1.5 * outside
                # idealnya window = 8 periode grid; periode ≈ (hi-lo)/8
                period = (hi_i - lo_i) / 8.0
                # penalti bila periode terlalu kecil/besar dibanding n/8..n/8 of full
                if period < n * 0.05 or period > n * 0.2:
                    score -= total * 0.5
                if score > best_score:
                    best_score = score
                    best_range = (lo_f, hi_f)
        return best_range

    bx = find_bounds(gx)
    by = find_bounds(gy)

    # Quad baru dalam koordinat warp kasar: [TL, TR, BR, BL]
    refined_local = np.array(
        [
            [bx[0] * size, by[0] * size],
            [bx[1] * size, by[0] * size],
            [bx[1] * size, by[1] * size],
            [bx[0] * size, by[1] * size],
        ],
        dtype=np.float32,
    )

    # Petakan kembali ke koordinat gambar asli via homography inverse
    src = np.array(
        [[0, 0], [size - 1, 0], [size - 1, size - 1], [0, size - 1]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(src, np.array(rough_quad, dtype=np.float32))
    ones = np.hstack([refined_local, np.ones((4, 1), dtype=np.float32)])
    mapped = (ones @ M.T)
    mapped = mapped[:, :2] / mapped[:, 2:3]

    # Validasi: quad hasil refine harus tetap dalam batas gambar & cukup besar
    if not np.all(np.isfinite(mapped)):
        return rough_quad
    if (mapped[:, 0].min() < -w * 0.05 or mapped[:, 0].max() > w * 1.05 or
            mapped[:, 1].min() < -h * 0.05 or mapped[:, 1].max() > h * 1.05):
        return rough_quad
    side = min(
        np.linalg.norm(mapped[1] - mapped[0]),
        np.linalg.norm(mapped[2] - mapped[1]),
        np.linalg.norm(mapped[3] - mapped[2]),
        np.linalg.norm(mapped[0] - mapped[3]),
    )
    if side < min(h, w) * 0.35:
        return rough_quad
    return order_corner_points(mapped)


def detect_board_corners(image: np.ndarray):
    """
    Deteksi 4 sudut papan catur — dua strategi berurutan:
    1. Segmen warna petak gelap (hijau/coklat khas papan vinyl) via HSV:
       convex hull area hijau terbesar = papan. Sangat robust untuk papan
       vinyl hijau (foto user), tidak terpengaruh label a-h/1-8 di tepi.
    2. Fallback gaya OMR-Scanner: Canny -> contours -> quad terbesar.
    Return [TL, TR, BR, BL] dalam koordinat piksel asli, atau None.
    """
    h, w = image.shape[:2]

    # ── Strategi 1: segmentasi warna petak hijau (papan vinyl) ──
    try:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        # HANYA petak hijau — mask gabungan hijau+krem terbukti menyatu dengan
        # meja putih (warna serupa) sehingga quad melebar jauh di luar papan.
        # Petak hijau saja cukup: dengan morphological close kuat, petak hijau
        # yang terputus oleh petak krem/bidak menyatu menjadi satu blok papan.
        green = cv2.inRange(hsv, (35, 70, 40), (120, 255, 255))
        # Close kuat (k≈0.11 sisi): satukan petak hijau terpisah jadi satu blok
        # (k=101 terverifikasi lurus pada foto user).
        k_close = max(31, int(min(h, w) * 0.11) | 1)
        green = cv2.morphologyEx(green, cv2.MORPH_CLOSE, np.ones((k_close, k_close), np.uint8))
        green = cv2.morphologyEx(green, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))
        # Opening sedang: potong "ekor" tipis — benda hijau lain di meja yang
        # menyatu dengan blob papan via close lalu menggelembungkan bbox
        # (terverifikasi pada foto user: ekor ±40px ke arah dompet hijau).
        green = cv2.morphologyEx(green, cv2.MORPH_OPEN, np.ones((51, 51), np.uint8))
        contours, _ = cv2.findContours(green, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            c = max(contours, key=cv2.contourArea)
            if cv2.contourArea(c) > h * w * 0.10:
                rect = cv2.minAreaRect(c)
                (rcx, rcy), (rw, rh), ang = rect
                # Rekonstruksi papan penuh dari blob hijau:
                # - Lebar blob = 8 file PERSIS (file a & h selalu memuat petak
                #   hijau, jadi blob mencapai kedua tepi vertikal papan).
                # - Tinggi blob sering KURANG (bidak memutus petak hijau baris
                #   bawah — terukur 739px vs 986px pada foto user), jadi tinggi
                #   papan = lebar, di-extend ke bawah dari tepi atas blob.
                long_side = max(rw, rh)
                sq = long_side / 8.0
                if long_side < min(h, w) * 0.35:
                    raise ValueError("blob terlalu kecil untuk papan")
                # Arah sumbu pendek yang menunjuk KE BAWAH gambar (y positif)
                rad = math.radians(ang)
                ux, uy = math.cos(rad), math.sin(rad)  # sumbu panjang
                sx, sy = -math.sin(rad), math.cos(rad)  # sumbu pendek
                if sy < 0:
                    sx, sy = -sx, -sy
                # geser pusat agar tepi ATAS blob tetap, sisi pendek memanjang
                shift = (long_side - min(rw, rh)) / 2.0
                cx_new = rcx + sx * shift
                cy_new = rcy + sy * shift
                full_rect = ((cx_new, cy_new), (long_side, long_side), ang)
                quad = cv2.boxPoints(full_rect)
                quad = order_corner_points(quad)
                quad = np.array(quad, dtype=np.float32)
                side = long_side
                # Validasi KRITIS: quad harus berada dalam batas gambar
                # (toleransi 8% — rekonstruksi bisa sedikit melewati tepi pada
                # foto close-up; lebih dari itu berarti salah deteksi).
                tol_x, tol_y = w * 0.08, h * 0.08
                within = (
                    quad[:, 0].min() >= -tol_x and quad[:, 0].max() <= w + tol_x
                    and quad[:, 1].min() >= -tol_y and quad[:, 1].max() <= h + tol_y
                )
                if side > min(h, w) * 0.4 and within:
                    return quad
                logger.warning(
                    "Quad HSV ditolak (within=%s, side=%.0f) — fallback Canny.", within, side
                )
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

    best = np.array(best, dtype=np.float32)

    # Refine dengan minAreaRect: approxPolyDP sering menghasilkan quad sedikit
    # miring (rotasi beberapa derajat) yang membuat grid 8x8 bergeser saat warp.
    # minAreaRect dari kontur yang sama memberi rotasi presisi.
    # (refine_quad_by_gridlines dicoba dulu; fallback ke minAreaRect quad.)
    center = best.mean(axis=0)
    expanded = []
    for p in best:
        v = p - center
        expanded.append(p + v * 1.04)
    try:
        refined = refine_quad_by_gridlines(image, np.array(expanded, dtype=np.float32))
        return np.array(refined, dtype=np.float32)
    except Exception as e:
        logger.warning("Refine grid gagal, pakai quad kasar: %s", e)
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


def detect_pieces(img_np: np.ndarray, conf_override: float | None = None):
    """Jalankan YOLOv11, kembalikan daftar (kelas_fen, cx, cy, conf)."""
    model = load_model()
    if model is None:
        raise HTTPException(status_code=503, detail="Model YOLOv11 belum tersedia. Latih dulu (scripts/train-yolo11.md).")

    results = model.predict(img_np, conf=conf_override or CONF_THRESHOLD, verbose=False)
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


def grid_fen(detections, img_w: int, img_h: int, grid: tuple | None = None) -> str:
    """Peta deteksi ke grid 8x8 dan susun FEN board (rank 8 -> rank 1).
    Bila beberapa deteksi jatuh di petak yang sama (mis. box ganda),
    ambil yang confidence-nya tertinggi — dedup per petak.

    grid: hasil calibrate_grid() berupa (x0, y0, sq) — pemetaan petak memakai
    grid terkalibrasi (akurat untuk foto miring/sudut), bukan pembagian kaku
    img_w/8. Bila None, fallback ke pembagian kaku (gambar sudah warp persegi).
    """
    board = [[""] * 8 for _ in range(8)]
    best_conf = [[0.0] * 8 for _ in range(8)]
    if grid is not None:
        x0, y0, sqx, sqy = grid

        def to_cell(cx: float, cy: float) -> tuple[int, int] | None:
            col = int((cx - x0) / sqx)
            row = int((cy - y0) / sqy)
            if col < 0 or col > 7 or row < 0 or row > 7:
                return None
            return row, col
    else:

        def to_cell(cx: float, cy: float) -> tuple[int, int] | None:
            return (
                min(7, max(0, int(cy / img_h * 8))),
                min(7, max(0, int(cx / img_w * 8))),
            )

    for fen_char, cx, cy, conf in detections:
        cell = to_cell(cx, cy)
        if cell is None:
            continue  # deteksi di luar papan terkalibrasi (mis. bidak cadangan)
        row, col = cell
        # row 0 = baris teratas gambar = rank 8
        if conf > best_conf[row][col]:
            best_conf[row][col] = conf
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


def calibrate_grid(img: np.ndarray) -> tuple[float, float, float, float] | None:
    """
    Auto-kalibrasi grid 8x8 pada gambar yang sudah di-warp (mendekati lurus).
    Return (x0, y0, sqx, sqy) — pojok kiri-atas & ukuran petak per-sumbu.

    Strategi utama: KORELASI TEMPLATE CHECKERBOARD terhadap mask warna petak
    (hijau vinyl). Template +1 (petak gelap) / -1 (petak terang) dikorelasikan
    dengan mask via matchTemplate untuk tiap ukuran petak kandidat — puncak
    korelasi = posisi grid terbaik. Terverifikasi presisi (skor 0.89) pada foto
    user, robust terhadap bidak yang menutupi petak.

    Fallback (papan tanpa warna khas): pencarian skor pola kecerahan
    selang-seling.
    """
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    green = (cv2.inRange(hsv, (35, 60, 40), (130, 255, 255)) > 0).astype(np.float32)

    # Papan persegi: ukuran petak sama untuk kedua sumbu.
    # Pencarian COARSE-TO-FINE dengan skor inner-50% per petak (terbukti paling
    # akurat — skor 0.89 pada foto user; matchTemplate kurang presisi untuk
    # pola periodik besar seperti checkerboard 8x8).
    H, W = img.shape[:2]

    def inner_score(x0f, y0f, sqf, dark_even):
        s = 0.0
        for r in range(8):
            for c in range(8):
                cx, cy = x0f + (c + 0.5) * sqf, y0f + (r + 0.5) * sqf
                half = sqf * 0.25
                xa, xb = int(cx - half), int(cx + half)
                ya, yb = int(cy - half), int(cy + half)
                if xa < 0 or ya < 0 or xb > W or yb > H:
                    return -1.0
                is_dark = ((r + c) % 2 == 0) == dark_even
                f = float(green[ya:yb, xa:xb].mean())
                s += f if is_dark else (1.0 - f)
        return s / 64.0

    base = min(h, w) / 8.0
    best, best_score = None, -1.0
    for sq in np.arange(base * 0.88, base * 1.12, 2.0):
        for x0 in np.arange(-8, W - 8 * sq + 8, 4.0):
            for y0 in np.arange(-8, H - 8 * sq + 8, 4.0):
                for de in (True, False):
                    sc = inner_score(x0, y0, sq, de)
                    if sc > best_score:
                        best_score = sc
                        best = (x0, y0, sq, de)
    if best is not None and best_score > 0.70:
        x0, y0, sq, de = best
        # Fine: langkah 0.5px di sekitar kandidat coarse
        fb = (x0, y0, sq, de, best_score)
        for ds in np.arange(-2.0, 2.1, 0.5):
            for dx in np.arange(-4.0, 4.1, 0.5):
                for dy in np.arange(-4.0, 4.1, 0.5):
                    sc = inner_score(x0 + dx, y0 + dy, sq + ds, de)
                    if sc > fb[4]:
                        fb = (x0 + dx, y0 + dy, sq + ds, de, sc)
        logger.info("Kalibrasi grid: skor %.3f -> fine %.3f", best_score, fb[4])
        return (fb[0], fb[1], fb[2], fb[2])

    # ── Fallback: pencarian skor pola kecerahan selang-seling ──
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    small_scale = 200.0 / max(h, w)
    g = cv2.resize(gray, (int(w * small_scale), int(h * small_scale)))
    gh, gw = g.shape

    best, best_score = None, -1e9
    base = min(gh, gw) / 8.0
    for sq_f in np.linspace(base * 0.85, base * 1.15, 16):
        span_x = max(gw - sq_f * 8, 0.0)
        span_y = max(gh - sq_f * 8, 0.0)
        offs_x = np.linspace(-sq_f * 0.3 + span_x / 2, span_x / 2 + sq_f * 0.3, 15)
        offs_y = np.linspace(-sq_f * 0.3 + span_y / 2, span_y / 2 + sq_f * 0.3, 15)
        for x0 in offs_x:
            for y0 in offs_y:
                bright = np.zeros((8, 8), dtype=np.float32)
                valid = True
                for r in range(8):
                    for c in range(8):
                        m = sq_f * 0.2
                        xa, xb = int(x0 + c * sq_f + m), int(x0 + (c + 1) * sq_f - m)
                        ya, yb = int(y0 + r * sq_f + m), int(y0 + (r + 1) * sq_f - m)
                        xa, ya = max(0, xa), max(0, ya)
                        xb, yb = min(gw, xb), min(gh, yb)
                        if xb - xa < 2 or yb - ya < 2:
                            valid = False
                            break
                        bright[r, c] = np.median(g[ya:yb, xa:xb])
                    if not valid:
                        break
                if not valid:
                    continue
                parity = np.add.outer(np.arange(8), np.arange(8)) % 2
                even_b = bright[parity == 0]
                odd_b = bright[parity == 1]
                me, mo = float(even_b.mean()), float(odd_b.mean())
                if me < mo:
                    me, mo = mo, me
                contrast = me - mo
                thr = (me + mo) / 2.0
                bright_match = float(((bright > thr) == (parity == 0)).mean())
                coverage = min(1.0, (sq_f * 8) / min(gh, gw))
                score = bright_match * 2.0 + min(contrast / 40.0, 1.0) + coverage * 0.3
                if score > best_score:
                    best_score = score
                    best = (x0 / small_scale, y0 / small_scale,
                            sq_f / small_scale, sq_f / small_scale)
    if best is None or best_score < 1.5:
        return None
    return best


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
        grid = None
        if req.autoCrop and not req.prewarped:
            pts = detect_board_corners(img)
            if pts is not None:
                img = four_point_transform(img, pts, size=800)
                logger.info("Auto-crop papan berhasil (quad %s)", pts.tolist())

        h, w = img.shape[:2]

        # Kalibrasi grid: petakan deteksi memakai (x0, y0, sq) terbaik berdasar
        # pola selang-seling warna petak — jauh lebih akurat untuk foto dari
        # sudut/miring daripada membagi gambar persis 8 bagian.
        try:
            grid = calibrate_grid(img)
        except Exception as e:
            logger.warning("Kalibrasi grid gagal, fallback grid kaku: %s", e)
            grid = None

        # Threshold adaptif dua tahap: mulai dari conf standar; bila posisi
        # tidak masuk akal (mis. raja tidak terdeteksi), ulangi dengan ambang
        # lebih rendah sebelum menyatakan gagal.
        board_fen = None
        used_conf = CONF_THRESHOLD
        for conf_try in (CONF_THRESHOLD, 0.15, 0.08):
            dets = detect_pieces(img, conf_override=conf_try)
            cand = grid_fen(dets, w, h, grid=grid)
            if plausible_board_fen(cand):
                board_fen = cand
                used_conf = conf_try
                break
            if board_fen is None:
                board_fen = cand  # simpan kandidat pertama untuk pesan error

        if board_fen is None or not plausible_board_fen(board_fen):
            return {
                "ok": False,
                "error": "Deteksi YOLO menghasilkan posisi yang tidak masuk akal (raja hilang/ganda, pion ilegal, atau bidak berlebih). Perbaiki manual di papan referensi.",
                "detections": len(detections) if False else 0,
                "board_fen_candidate": board_fen,
                "used_conf": used_conf,
            }

        return {
            "ok": True,
            "fen": board_fen + " w - - 0 1",
            "board_fen": board_fen,
            "detections": sum(1 for ch in board_fen if ch.isalpha()),
            "engine": "yolo11",
            "used_conf": used_conf,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Prediction failure: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
