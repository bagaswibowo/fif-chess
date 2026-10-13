"""Fallback chessboard localization — sintesis 3 repo open-source:

- Elucidation/ChessboardDetect (Brutesac.py, SaddlePoints.py):
  saddle point detection (Hessian determinant) + brutesac: coba tiap quad,
  warp semua titik ke unity grid, hitung kecocokan ke grid ideal dengan
  offset terbaik (7x7), refine homography LMEDS. Metode paling robust.
- simarmehta/chessAutomation_CV (helper.py):
  seed homography dari kontur quad -> grid 7x7 iteratif yang memakai saddle
  points terdekat untuk memperbaiki homography berulang (RANSAC re-fit).
- yaseralie/Chess-Tracker (calibrate_manual_oriented.py):
  fallback manual 4-titik (sudah di-cover oleh crop modal di client).

Output: homography gambar -> papan ideal berformat chesscog (500x500, papan
400x400 di tengah, margin 50px) siap dipakai crop_square classifier.
"""

from typing import Optional, Tuple

import cv2
import numpy as np
from chesscog.core.exceptions import ChessboardNotLocatedException

from chesscog.corner_detection.opencv_fallback_constants import (
    IMG_SIZE, MARGIN, BOARD_SIZE, SQUARE, IDEAL_CORNERS,
)

# ── Konstanta metode saddle/brutesac ──────────────────────────────────────
SADDLE_MIN_SCORE = 10_000      # ambang respons Hessian (Elucidation hardcoded)
SADDLE_NMS_WIN = 21            # non-max suppression window (pada gambar kerja
                               # ~500px, 1 petak ~50px — win 21 memisahkan
                               # puncak ganda di tiap persimpangan)
BRUTESAC_MAX_QUADS = 400       # batas quad yang dicoba (perf)
MIN_INLIER_PTS = 24            # minimal titik yang match ke grid ideal


def order_quad_corners(pts: np.ndarray) -> np.ndarray:
    """Urutkan 4 titik jadi (TL, TR, BR, BL)."""
    pts = pts.reshape(4, 2).astype(np.float32)
    s = pts.sum(axis=1)
    d = pts[:, 0] - pts[:, 1]
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmax(d)]
    bl = pts[np.argmin(d)]
    return np.float32([tl, tr, br, bl])


# ── Saddle points (Elucidation/SaddlePoints.py) ───────────────────────────
SADDLE_WORK_SIZE = 500  # gambar kerja saddle ala Elucidation base_imgload


def get_saddle_points(gray: np.ndarray) -> Tuple[np.ndarray, float]:
    """Deteksi sudut papan via Hessian determinant (saddle / x-corner).
    Gambar DULU diskalakan ke ~500px (kunci dari Elucidation: threshold &
    NMS window hanya valid pada skala itu). Return (titik x,y pada gambar
    KERJA, faktor skala ke gambar asli)."""
    h, w = gray.shape[:2]
    scale = min(1.0, SADDLE_WORK_SIZE / max(h, w))
    if scale < 1.0:
        work = cv2.resize(gray, (int(w * scale), int(h * scale)),
                          interpolation=cv2.INTER_AREA)
    else:
        work = gray
    img = cv2.blur(work, (3, 3)).astype(np.float32)
    gx = cv2.Sobel(img, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(img, cv2.CV_32F, 0, 1)
    gxx = cv2.Sobel(gx, cv2.CV_32F, 1, 0)
    gyy = cv2.Sobel(gy, cv2.CV_32F, 0, 1)
    gxy = cv2.Sobel(gx, cv2.CV_32F, 0, 1)

    # Saddle: -gxx*gyy + gxy^2 > 0 berarti x-corner
    S = -gxx * gyy + gxy * gxy

    # Sub-pixel offsets (Elucidation)
    denom = gxx * gyy - gxy * gxy
    sub_s = np.divide(gy * gxy - gx * gyy, denom,
                      out=np.zeros_like(denom), where=denom != 0)
    sub_t = np.divide(gx * gxy - gy * gxx, denom,
                      out=np.zeros_like(denom), where=denom != 0)

    # Non-max suppression cepat (dilate-compare)
    element = np.ones([SADDLE_NMS_WIN, SADDLE_NMS_WIN], np.uint8)
    dilated = cv2.dilate(S, element)
    peaks = cv2.compare(S, dilated, cv2.CMP_EQ)
    S[peaks == 0] = 0

    # Ambang relatif ke MAKSIMUM (Elucidation: S<10000 pada gambar ~500px
    # dgn S_max ~1e6 = 1%): saddle asli jauh lebih kuat dari noise tepi.
    smax = float(S.max())
    if smax <= 0:
        return np.empty((0, 2), np.float32), scale
    S[S < smax * 0.01] = 0

    idx = np.nonzero(S)
    if len(idx[0]) == 0:
        return np.empty((0, 2), np.float32), scale
    pts = np.stack([idx[1], idx[0]], axis=1).astype(np.float64)  # x,y
    pts += np.stack([sub_s[idx], sub_t[idx]], axis=1)

    # clipBoundingPoints ala Elucidation: buang titik dekat tepi gambar —
    # tepi foto (fill warp vs latar) menciptakan saddle palsu berjajar.
    m = 15
    keep = ((pts[:, 0] > m) & (pts[:, 0] < work.shape[1] - m)
            & (pts[:, 1] > m) & (pts[:, 1] < work.shape[0] - m))
    pts = pts[keep]
    return pts.astype(np.float32), scale


# ── Brutesac (Elucidation/Brutesac.py) ────────────────────────────────────
def _count_hits(pts_int: np.ndarray, x_off: int, y_off: int) -> int:
    pt_set = set(map(tuple, pts_int))
    X, Y = np.meshgrid(np.arange(7) + x_off, np.arange(7) + y_off)
    return sum(1 for x, y in zip(X.flatten(), Y.flatten()) if (x, y) in pt_set)


def _best_board_matchup(pts_int: np.ndarray) -> Tuple[int, Tuple[int, int]]:
    best_score, best_off = 0, (0, 0)
    for i in range(7):
        for j in range(7):
            score = _count_hits(pts_int, i - 6, j - 6)
            if score > best_score:
                best_score, best_off = score, (i - 6, j - 6)
    return best_score, best_off


def _score_quad(quad: np.ndarray, pts: np.ndarray,
                prev_best: int = 0) -> Tuple[int, Optional[float], np.ndarray, Tuple[int, int]]:
    ideal = np.array([[0, 1], [1, 1], [1, 0], [0, 0]], np.float32)
    M = cv2.getPerspectiveTransform(quad.astype(np.float32), ideal)
    warped = cv2.perspectiveTransform(np.expand_dims(pts.astype(np.float32), 0), M)[0]
    w_int = warped.round().astype(int)

    # Refine homography dari titik -> snap integer (Elucidation)
    M_ref, _ = cv2.findHomography(pts.astype(np.float32), w_int.astype(np.float32), cv2.RANSAC)
    if M_ref is not None:
        warped = cv2.perspectiveTransform(
            np.expand_dims(pts.astype(np.float32), 0), M_ref)[0]
        w_int = warped.round().astype(int)

    score, offset = _best_board_matchup(w_int)
    if score <= prev_best:
        return score, None, M_ref if M_ref is not None else M, offset
    err = float(np.sum(np.linalg.norm(warped - w_int, axis=1)))
    return score, err, (M_ref if M_ref is not None else M), offset


def brutesac_chessboard(pts: np.ndarray) -> Tuple[Optional[np.ndarray], int]:
    """Cari homography unity-grid terbaik dari saddle points (img -> unity).
    Return (M_img_to_unity, score)."""
    if len(pts) < 12:
        return None, 0

    # Bangun quad dari Delaunay triangulation (Elucidation getAllQuads)
    try:
        from scipy.spatial import Delaunay
        tri = Delaunay(pts)
    except Exception:
        return None, 0

    quads = []
    seen = set()
    for i, neighbors in enumerate(tri.neighbors):
        for k in range(3):
            nk = neighbors[k]
            if nk == -1:
                continue
            pair = (i, nk)
            if (nk, i) in seen or pair in seen:
                continue
            seen.add(pair)
            b = tri.simplices[i]
            d = tri.simplices[nk]
            extra = list(set(d) - set(b))
            if len(extra) != 1:
                continue
            insert_map = [2, 3, 1]
            quads.append(np.insert(b, insert_map[k], extra[0]))
            if len(quads) >= BRUTESAC_MAX_QUADS:
                break
        if len(quads) >= BRUTESAC_MAX_QUADS:
            break
    if not quads:
        return None, 0

    # Estimasi ukuran 1 petak (px) dari median NN-dist antar saddle points:
    # saddle asli berjarak ~1 petak (bukan pecahan).
    from scipy.spatial import cKDTree
    tree = cKDTree(pts)
    nn_d, _ = tree.query(pts, k=2)
    square_px = float(np.median(nn_d[:, 1]))

    def _validate_span(M_cand: np.ndarray, off: Tuple[int, int]) -> bool:
        """M kandidat harus memetakan saddle pts ke grid 9x9 garis (span 8
        unit per axis, toleransi ±1 — papan bisa terpotong tepi)."""
        w = cv2.perspectiveTransform(np.expand_dims(pts.astype(np.float32), 0), M_cand)[0]
        w_int = w.round().astype(int)
        xs = set(w_int[:, 0] - off[0])
        ys = set(w_int[:, 1] - off[1])
        sx = max(xs) - min(xs) + 1
        sy = max(ys) - min(ys) + 1
        return 7 <= sx <= 9 and 7 <= sy <= 9

    best_score, best_err, best_M, best_off = 0, None, None, (0, 0)
    for q in quads:
        quad_pts = pts[q]
        # Perbaiki winding: urutkan 4 titik melingkar (Delaunay pairing bisa
        # menghasilkan quad self-intersecting → homography kacau).
        c = quad_pts.mean(axis=0)
        ang = np.arctan2(quad_pts[:, 1] - c[1], quad_pts[:, 0] - c[0])
        quad_pts = quad_pts[np.argsort(ang)]
        score, err, M, off = _score_quad(quad_pts, pts, best_score)
        if err is None:
            continue
        # Saringan utama: M kandidat harus memetakan titik-titik ke grid
        # 9x9 garis (span 7..9 per axis). Ini menolak quad salah skala
        # (2x2 petak dsb.) yang kebetulan match secara integer.
        if score > best_score and _validate_span(M, off):
            best_score, best_err, best_M, best_off = score, err, M, off
        if best_score > len(pts) * 0.8:
            break

    if best_M is None or best_score < MIN_INLIER_PTS:
        return None, best_score

    # Refine final dengan LMEDS (Elucidation refineHomography).
    # PENTING: skala unity tergantung ukuran quad yang kebetulan terpilih
    # (quad 2x2 petak menghasilkan grid dengan jarak antar-titik = 2, bukan 1).
    # Setelah offset, ukur jarak median antar titik tetangga grid lalu
    # normalisasi supaya 1 petak = 1 unit.
    warped = cv2.perspectiveTransform(np.expand_dims(pts.astype(np.float32), 0), best_M)[0]
    w_int = warped.round().astype(int)
    a = w_int - np.array(best_off)
    mask = np.all((a >= 0) & (a <= 7), axis=1)
    if mask.sum() < MIN_INLIER_PTS:
        return None, best_score

    a_in = a[mask].astype(np.float64)
    warped_in = warped[mask]
    # Skala: median jarak pasangan titik yang bertetangga (selisih grid = 1)
    dists = []
    n_in = len(a_in)
    for i in range(n_in):
        for j in range(i + 1, n_in):
            if abs(a_in[i][0] - a_in[j][0]) + abs(a_in[i][1] - a_in[j][1]) == 1:
                dists.append(np.linalg.norm(warped_in[i] - warped_in[j]))
    if not dists:
        return None, best_score
    unit_px = float(np.median(dists))
    if unit_px < 1e-6:
        return None, best_score

    # Koordinat unity ternormalisasi: petak = 1 unit, papan 8x8 berpusat
    # 0..8. x_u = a.x * unit / unit_px? Tidak — a sudah dalam satuan grid;
    # yang perlu dinormalisasi adalah SPASI warp. Karena M adalah img->grid,
    # grid koordinat a sudah benar (0..7). Skala tak masalah untuk koordinat
    # target — LMEDS fit img->a langsung menghasilkan grid 1 petak = 1 unit.
    M_final, _ = cv2.findHomography(pts[mask].astype(np.float32),
                                    a_in.astype(np.float32), cv2.LMEDS)
    if M_final is None:
        return None, best_score
    return M_final, best_score


# ── Kontur quad (cadangan, dari versi sebelumnya + is_square simarmehta) ──
def _is_square(cnt: np.ndarray, eps: float = 3.0, xratio_thresh: float = 0.5) -> bool:
    """Validasi quad ala simarmehta is_square: sudut 40-140deg, sisi proporsional."""
    pts = cnt.reshape(4, 2).astype(np.float64)
    dd = np.sqrt(np.sum(np.square(np.diff(np.vstack([pts, pts[:1]]), axis=0)), axis=1))
    if np.any(dd < 1e-6):
        return False
    xa = np.linalg.norm(pts[0] - pts[2])
    xb = np.linalg.norm(pts[1] - pts[3])
    xratio = min(xa, xb) / max(xa, xb)

    def angle(a, b, c):
        k = (a * a + b * b - c * c) / (2 * a * b)
        return np.degrees(np.arccos(max(-1, min(1, k))))

    angles = np.array([angle(dd[i], dd[(i + 1) % 4], xb if i % 2 == 0 else xa)
                       for i in range(4)])
    good_angles = np.all((angles > 40) & (angles < 140))
    side_ratios = np.array([max(dd[i] / dd[(i + 1) % 4], dd[(i + 1) % 4] / dd[i])
                            for i in range(4)])
    return bool(good_angles and np.all(side_ratios < eps) and xratio > xratio_thresh)


def _find_quad_by_contour(img_rgb: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    img_area = img_rgb.shape[0] * img_rgb.shape[1]

    for lo, hi in ((40, 120), (60, 180), (30, 90)):
        edges = cv2.Canny(gray, lo, hi, apertureSize=3)
        edges = cv2.dilate(edges, np.ones((5, 5), np.uint8))
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:8]:
            if cv2.contourArea(cnt) < img_area * 0.15:
                continue
            peri = cv2.arcLength(cnt, True)
            for eps in (0.02, 0.03, 0.05, 0.08):
                approx = cv2.approxPolyDP(cnt, eps * peri, True)
                if len(approx) == 4 and cv2.isContourConvex(approx) and _is_square(approx):
                    return approx.reshape(4, 2)
    raise ChessboardNotLocatedException("no quad contour found")


# ── Snap garis grid via gradient profile (simarmehta getBestLines) ──────
def _refine_with_gradient_lines(img_rgb: np.ndarray,
                                M_img_to_cc: np.ndarray) -> np.ndarray:
    """Refine homography: warp gambar ke papan chesscog, cari posisi 9 garis
    grid terbaik via skor gradien Sobel per kolom/baris (positif×negatif —
    puncak di transisi hitam-putih), lalu re-fit homography dari garis-garis
    itu. Mengoreksi shift/skala kecil dari brutesac."""
    warped = cv2.warpPerspective(img_rgb, M_img_to_cc, (IMG_SIZE, IMG_SIZE))
    g = cv2.blur(cv2.cvtColor(warped, cv2.COLOR_RGB2GRAY), (5, 5)).astype(np.float32)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1)

    # Skor kolom: (sum gradien positif) × (sum gradien negatif) — maksimum
    # tepat di garis vertikal papan (simarmehta getBestLines).
    gx_pos = np.maximum(gx, 0).sum(axis=0)
    gx_neg = np.maximum(-gx, 0).sum(axis=0)
    score_x = gx_pos * gx_neg
    gy_pos = np.maximum(gy, 0).sum(axis=1)
    gy_neg = np.maximum(-gy, 0).sum(axis=1)
    score_y = gy_pos * gy_neg

    # Untuk tiap garis ideal (i*50+50), cari puncak skor dalam ±12px.
    lines_x = []
    lines_y = []
    half = 12
    for i in range(9):
        base = MARGIN + i * SQUARE
        x0, x1 = max(0, base - half), min(IMG_SIZE, base + half + 1)
        lines_x.append(x0 + int(np.argmax(score_x[x0:x1])))
        y0, y1 = max(0, base - half), min(IMG_SIZE, base + half + 1)
        lines_y.append(y0 + int(np.argmax(score_y[y0:y1])))

    # Monoton: paksa non-descreasing (hindari puncak ganda saling silang)
    for arr in (lines_x, lines_y):
        for i in range(1, len(arr)):
            if arr[i] <= arr[i - 1]:
                arr[i] = arr[i - 1] + 1

    # Re-fit homography: titik grid img (dari M lama) -> titik grid baru
    src_pts, dst_pts = [], []
    for i, gy_i in enumerate(lines_y):
        for j, gx_j in enumerate(lines_x):
            # titik grid ideal di papan chesscog
            u = MARGIN + j * SQUARE
            v = MARGIN + i * SQUARE
            # balikan: di mana titik ini di gambar asli? pakai inv(M)
            p = cv2.perspectiveTransform(
                np.float32([[[(u), (v)]]]), np.linalg.inv(M_img_to_cc))[0, 0]
            src_pts.append(p)
            dst_pts.append((gx_j, gy_i))
    M_ref, _ = cv2.findHomography(np.array(src_pts, np.float32),
                                  np.array(dst_pts, np.float32), cv2.LMEDS)
    if M_ref is None:
        return M_img_to_cc
    return M_ref



def _pick_best_offset(img_rgb: np.ndarray, M_cc: np.ndarray) -> np.ndarray:
    """Koreksi ambiguitas offset ±1 petak dari brutesac: coba 9 shift, pilih
    yang garis grid internalnya paling tajam (skor gradien Sobel di garis)."""
    g_full = cv2.warpPerspective(img_rgb, M_cc, (IMG_SIZE, IMG_SIZE))
    g = cv2.cvtColor(g_full, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1)

    def grid_score(dx: int, dy: int) -> float:
        # Garis vertikal internal x = MARGIN + i*SQUARE + dx (i=1..7)
        s = 0.0
        for i in range(1, 8):
            x = MARGIN + i * SQUARE + dx
            if 0 <= x < IMG_SIZE:
                s += float(np.abs(gx[:, x - 2:x + 3]).max(axis=1).mean())
            y = MARGIN + i * SQUARE + dy
            if 0 <= y < IMG_SIZE:
                s += float(np.abs(gy[y - 2:y + 3, :]).max(axis=0).mean())
        return s

    best, best_M = -1.0, M_cc
    for dx in (-SQUARE, 0, SQUARE):
        for dy in (-SQUARE, 0, SQUARE):
            # Shift = translasi homography: geser koordinat target dx,dy px
            T = np.array([[1, 0, dx], [0, 1, dy], [0, 0, 1]], np.float64)
            cand = T @ M_cc
            sc = grid_score(dx, dy)
            if sc > best:
                best, best_M = sc, cand
    return best_M


# ── API utama ─────────────────────────────────────────────────────────────
def _unity_to_chesscog(M_unity: np.ndarray) -> np.ndarray:
    """Homography img->unity grid (-1..7) dikonversi ke img->papan chesscog.
    Unity: petak papan menempati koordinat (-1..7); papan 400px di tengah
    gambar 500 => x_chesscog = (u + 1) * 50, y sama."""
    A = np.array([[50, 0, 50],
                  [0, 50, 50],
                  [0, 0, 1]], np.float64)
    return A @ M_unity


def find_board_homography(img_rgb: np.ndarray) -> np.ndarray:
    """Homography gambar -> papan ideal chesscog 500x500 (papan 400 di tengah).

    Urutan strategi:
    1. Saddle points + brutesac (Elucidation) — paling robust utk foto nyata.
    2. Kontur quad (Canny + approxPolyDP + is_square) — cadangan.
    """
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)

    # 1. Saddle + brutesac (pada gambar kerja ~500px).
    # Area saddle DIBATASI oleh kontur quad terbesar (hibrida) — tanpa ini,
    # tepi foto/latar menghasilkan saddle palsu yang merusak brutesac.
    try:
        pts, saddle_scale = get_saddle_points(gray)
        if len(pts) >= 12:
            try:
                quad_mask = _find_quad_by_contour(img_rgb)
                quad_w = quad_mask.astype(np.float32) * saddle_scale
                from cv2 import fillConvexPoly
                region = np.zeros(gray.shape, np.uint8)
                fillConvexPoly(region, quad_w.astype(np.int32), 255)
                region = cv2.dilate(region, np.ones((15, 15), np.uint8))
                inside = region[
                    np.clip(pts[:, 1].astype(int), 0, gray.shape[0] - 1),
                    np.clip(pts[:, 0].astype(int), 0, gray.shape[1] - 1)] > 0
                filtered = pts[inside]
                if len(filtered) >= 12:
                    pts = filtered
            except ChessboardNotLocatedException:
                pass  # tanpa kontur — pakai semua saddle points
            M_unity, score = brutesac_chessboard(pts)
            if M_unity is not None:
                # Homography dari koordinat gambar kerja -> koordinat asli
                S_up = np.array([[1/saddle_scale, 0, 0],
                                 [0, 1/saddle_scale, 0],
                                 [0, 0, 1]], np.float64)
                M_full = S_up @ M_unity
                return _pick_best_offset(img_rgb, _unity_to_chesscog(M_full))
    except ChessboardNotLocatedException:
        pass
    except Exception:
        pass  # scipy unavailable dll — lanjut ke cadangan

    # 2. Kontur quad
    quad = _find_quad_by_contour(img_rgb)
    return cv2.getPerspectiveTransform(order_quad_corners(quad), IDEAL_CORNERS)
