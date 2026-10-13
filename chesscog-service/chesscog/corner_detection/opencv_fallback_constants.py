"""Konstanta bersama untuk deteksi papan fallback & occupancy CV."""

import numpy as np

# Format yang dibutuhkan chesscog crop_square: gambar 500x500 dengan papan
# 400x400 ber-margin 50px di tengah (SQUARE_SIZE=50, lihat create_dataset.py).
IMG_SIZE = 500
MARGIN = 50
BOARD_SIZE = 400
SQUARE = BOARD_SIZE // 8

# Empat sudut papan ideal (TL, TR, BR, BL) dalam gambar warp 500x500.
IDEAL_CORNERS = np.array([
    [MARGIN, MARGIN],
    [MARGIN + BOARD_SIZE, MARGIN],
    [MARGIN + BOARD_SIZE, MARGIN + BOARD_SIZE],
    [MARGIN, MARGIN + BOARD_SIZE],
], dtype=np.float32)
