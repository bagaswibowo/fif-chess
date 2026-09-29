"""Deteksi keberadaan bidak per-petak dengan computer vision klasik.

Teknik diadaptasi dari yaseralie/Chess-Tracker:
- Weighted grayscale (0.5R + 0.4G + 0.1B) yang menekan kanal biru — bidak
  putih gading & petak krem lebih mudah dipisah, bidak hitam menonjol dari
  petak hijau.
- Petak kosong = warna seragam (median mendominasi); petak berisi bidak =
  fraksi piksel menyimpang jauh dari median warna petak.

Bekerja pada gambar hasil warp (500x500, papan 400x400 di tengah) dan
menggabungkan/menggantikan keputusan occupancy model chesscog — model
dilatih dari render papan standar sehingga sering melewatkan bidak putih
gading di petak krem pada foto papan hijau/krem dunia nyata.
"""

from typing import Optional

import cv2
import numpy as np
import chess

from chesscog.corner_detection.opencv_fallback_constants import MARGIN, BOARD_SIZE, SQUARE

# Fraksi piksel petak yang harus menyimpang dari median agar dianggap berisi
# bidak. Turunkan jika bidak kecil/terpotong, naikkan jika banyak false positive.
OCCUPANCY_FRACTION = 0.05
# Ambang simpangan warna per-kanal dari median petak (0-255). Per-kanal penting:
# bidak gading di petak krem hampir identik di grayscale (selisih ~13) tapi
# terlihat jelas di kanal biru (~25). Ambang 12 menangkap bidak yang warnanya
# mirip petaknya (gading di petak terang) tanpa false positive pada noise tipikal.
DEVIATION_THRESHOLD = 12
# Sinyal 2 (image_segment.py): std deviasi area dalam petak & fraksi tepi.
STD_THRESHOLD = 10.0
EDGE_FRACTION_THRESHOLD = 0.05


def weighted_gray(img_rgb: np.ndarray) -> np.ndarray:
    """Grayscale berbobot ala Chess-Tracker: 0.5R + 0.4G + 0.1B (kanal biru
    ditekan — papan hijau & bidak gading lebih kontras)."""
    return (0.5 * img_rgb[:, :, 0] + 0.4 * img_rgb[:, :, 1]
            + 0.1 * img_rgb[:, :, 2]).astype(np.uint8)


def _square_crop(warped_gray: np.ndarray, square: chess.Square,
                 turn: chess.Color) -> np.ndarray:
    """Crop petak dari gambar warp — koordinat sama dengan crop_square
    chesscog (petak inti 50px, tanpa margin ganda)."""
    rank = chess.square_rank(square)
    file = chess.square_file(square)
    if turn == chess.WHITE:
        row, col = 7 - rank, file
    else:
        row, col = rank, 7 - file
    y0 = MARGIN + int(row * SQUARE)
    x0 = MARGIN + int(col * SQUARE)
    return warped_gray[y0:y0 + SQUARE, x0:x0 + SQUARE]


def square_occupied(warped_rgb: np.ndarray, square: chess.Square,
                    turn: chess.Color) -> bool:
    """True bila petak berisi bidak — gabungan 2 sinyal:

    1. Deviasi warna per-kanal dari median petak (bidak gading di petak krem
       hampir identik di grayscale, tapi terlihat di kanal biru).
    2. Std-deviasi area dalam petak + edge density (ala image_segment.py
       ChessboardDetect): petak kosong polos punya std rendah & tanpa tepi
       internal; bidak apapun warnanya menaikkan keduanya.
    """
    rank = chess.square_rank(square)
    file = chess.square_file(square)
    if turn == chess.WHITE:
        row, col = 7 - rank, file
    else:
        row, col = rank, 7 - file
    y0 = MARGIN + int(row * SQUARE)
    x0 = MARGIN + int(col * SQUARE)
    crop = warped_rgb[y0:y0 + SQUARE, x0:x0 + SQUARE]
    crop_blur = cv2.GaussianBlur(crop, (3, 3), 0)

    # Sinyal 1: deviasi per-kanal dari median
    c16 = crop_blur.astype(np.int16)
    med = np.median(c16.reshape(-1, 3), axis=0)
    dev = np.abs(c16 - med[None, None, :]).max(axis=2)
    frac_dev = float((dev > DEVIATION_THRESHOLD).mean())
    signal1 = frac_dev > OCCUPANCY_FRACTION

    # Sinyal 2: std deviasi-per-kanal area dalam (margin 8px ala
    # image_segment.py). Memakai kanal deviasi (bukan grayscale mentah) karena
    # bidak gading vs petak krem hanya beda ~12 tingkat grayscale — std
    # grayscale-nya di bawah noise, tapi kanal biru memisahkan mereka.
    g = weighted_gray(crop)
    dev_inner = dev[8:-8, 8:-8].astype(np.float64)
    std_inner = float(dev_inner.std())
    # Edge density: Canny di area dalam petak (bidak selalu punya tepi internal)
    edges = cv2.Canny(g, 40, 120)
    inner_edges = edges[10:-10, 10:-10]
    edge_frac = float((inner_edges > 0).mean())
    signal2 = std_inner > STD_THRESHOLD or edge_frac > EDGE_FRACTION_THRESHOLD

    # Bidak ada bila SALAH SATU sinyal kuat menyala (recall tinggi — false
    # positive ditahan oleh union terbatas <=32 bidak di occupancy_cv()).
    return signal1 or signal2


def occupancy_cv(warped: np.ndarray, turn: chess.Color,
                 model_occupancy: Optional[np.ndarray] = None) -> np.ndarray:
    """Gabungkan keputusan occupancy CV klasik dengan model chesscog.

    Args:
        warped: gambar 500x500 hasil warp (RGB) dengan papan 400x400 di tengah.
        turn: orientasi papan (putih/hitam di bawah).
        model_occupancy: hasil occupancy model chesscog per petak (opsional).
            Strategi: petak yang dikatakan berisi oleh SALAH SATU metode
            dianggap berisi (union) — mengurangi bidak terlewat; petak yang
            dikatakan kosong oleh kedua metode pasti kosong.

    Returns:
        Boolean array sepanjang 64 (urutan chess.SQUARES) = ada bidak.
    """
    g = weighted_gray(warped)
    squares = list(chess.SQUARES)
    cv_occ = np.array([square_occupied(warped, sq, turn) for sq in squares])

    if model_occupancy is None:
        return cv_occ

    combined = np.logical_or(np.asarray(model_occupancy, bool), cv_occ)
    # Batasi total bidak: bila union menghasilkan >32 petak terisi (mustahil
    # dalam catur nyata), fallback ke keputusan model saja.
    if combined.sum() > 32:
        return np.asarray(model_occupancy, bool)
    return combined


def estimate_piece_colors(warped: np.ndarray, turn: chess.Color,
                          occupancy: np.ndarray) -> np.ndarray:
    """Klasifikasi warna bidak (putih/hitam) per petak terisi via kecerahan
    weighted-gray bidak vs median petaknya. Mengembalikan array bool:
    True = putih, False = hitam (hanya valid di petak terisi)."""
    g = weighted_gray(warped)
    squares = list(chess.SQUARES)
    out = np.zeros(len(squares), bool)
    board_mean = float(np.median(g[MARGIN:MARGIN + BOARD_SIZE,
                                   MARGIN:MARGIN + BOARD_SIZE]))
    for i, sq in enumerate(squares):
        if not occupancy[i]:
            continue
        crop = _square_crop(g, sq, turn)
        # Piksel bidak = piksel yang menyimpang dari median petak
        med = np.median(crop)
        mask = cv2.absdiff(crop, np.full_like(crop, med)) > DEVIATION_THRESHOLD
        if mask.sum() < 10:
            piece_bright = crop.mean()
        else:
            piece_bright = float(crop[mask].mean())
        # Bidak terang bila kecerahannya di atas rata-rata papan
        out[i] = piece_bright > board_mean
    return out
