"""Self-check untuk akar bug impor FEN: pemetaan bidak ke petak.

Jalankan (perlu numpy + cv2 + chess):
  docker compose run --rm --no-deps -v "$PWD/yolo11-service:/app" \
      --entrypoint python yolo11 test_fen_mapping.py

YANG DIUJI:
1. calibrate_grid() tetap 4-elemen & menemukan papan utuh.
2. orient_from_detections() baca sisi pandang dari WARNA bidak baris bawah.
   Dicatat: kecerahan checkerboard TIDAK bisa dipakai — checkerboard simetris
   180°, jadi a8 vs h1 tak pernah bisa dibedakan dari brightness (dibuktikan).
3. grid_fen() taruh bidak tinggi di petak DASARNYA (anchor 80% tinggi),
   bukan petak di atasnya seperti lama (tengah kotak bounding box).
"""
import sys

import numpy as np

sys.path.insert(0, ".")
import server as S

SQ = 100


def synth_board() -> np.ndarray:
    """Board 8x8, baris atas gambar = rank 8 (sisi Putih). a1 gelap."""
    img = np.zeros((SQ * 8, SQ * 8, 3), np.uint8)
    for r in range(8):
        for c in range(8):
            light = (r + c) % 2 == 0
            img[r * SQ:(r + 1) * SQ, c * SQ:(c + 1) * SQ] = 200 if light else 60
    return img


def test_calibrate_shape():
    calib = S.calibrate_grid(synth_board())
    assert calib is not None, "kalibrasi gagal pada board sintetis"
    assert len(calib) == 4, f"calibrate_grid harus 4-elemen, dapat {len(calib)}"
    x0, y0, sq, score = calib
    assert score > 0.9, f"skor checkerboard board ideal harus tinggi, dapat {score}"
    assert sq > 10, f"sq tidak masuk akal: {sq}"
    print(f"  OK calibrate_grid: (x0={x0:.1f}, y0={y0:.1f}, sq={sq:.1f}) skor={score:.3f}")


def test_checkerboard_cannot_give_orientation():
    """Bukti bahwa orientasi TIDAK bisa dari kecerahan: rotasi 180° memberi
    korelasi bertanda yang SAMA. Jadi jangan pakai tanda untuk orientasi."""
    a = synth_board()
    b = a[::-1, ::-1].copy()
    gray_a = S.cv2.cvtColor(a, S.cv2.COLOR_BGR2GRAY).astype(np.float32)
    signed = S._checker_signed(S._cell_brightness(gray_a, 0.0, 0.0, float(SQ)))
    assert abs(signed) > 0.99, f"board ideal harus korelasi sempurna, dapat {signed}"
    # Rotasi 180 board ideal -> korelasi tetap ~sempurna (bukan berubah tanda drastis),
    # menegaskan brightness tidak membawa info sisi pandang.
    gray_b = S.cv2.cvtColor(b, S.cv2.COLOR_BGR2GRAY).astype(np.float32)
    signed_b = S._checker_signed(S._cell_brightness(gray_b, 0.0, 0.0, float(SQ)))
    assert abs(signed_b) > 0.99, "rotasi 180 board ideal juga korelasi sempurna"
    print(f"  OK checkerboard symmetric: white={signed:+.4f} black={signed_b:+.4f}")


def test_orientation_from_colors():
    """Baris bawah 2 bidak se warna -> sisi itu, dua arah."""
    grid = (0.0, 0.0, float(SQ), 1.0)
    cases = [
        ([("P", 0.5 * SQ, 6.5 * SQ, 0.5 * SQ, 0.9),
          ("N", 1.5 * SQ, 6.5 * SQ, 0.6 * SQ, 0.9),
          ("p", 2.5 * SQ, 1.5 * SQ, 0.5 * SQ, 0.9)], "white_bottom"),
        ([("p", 0.5 * SQ, 6.5 * SQ, 0.5 * SQ, 0.9),
          ("r", 1.5 * SQ, 6.5 * SQ, 0.6 * SQ, 0.9),
          ("P", 2.5 * SQ, 1.5 * SQ, 0.5 * SQ, 0.9)], "black_bottom"),
    ]
    for dets, want in cases:
        got = S.orient_from_detections(dets, grid)
        assert got == want, f"harus {want}, dapat {got}"
        print(f"  OK orient_from_detections -> {got}")


def test_orientation_uncertain_returns_none():
    grid = (0.0, 0.0, float(SQ), 1.0)
    dets = [("K", 3.5 * SQ, 6.5 * SQ, 0.9 * SQ, 0.95)]
    assert S.orient_from_detections(dets, grid) is None, "satu bidak bukan bukti"
    dets2 = [
        ("K", 3.5 * SQ, 6.5 * SQ, 0.9 * SQ, 0.95),
        ("k", 4.5 * SQ, 6.5 * SQ, 0.9 * SQ, 0.95),
    ]
    assert S.orient_from_detections(dets2, grid) is None, "baris tercampur harus None"
    assert S.orient_from_detections([], grid) is None, "deteksi kosong harus None"
    print("  OK orient_from_detections menolak bukti tipis (None)")


def test_grid_fen_anchors_piece_base():
    """Bidak tinggi menutup petak di belakangnya. Kotak 2.5-4.5 (h=2 petak):
    titik TENGAH jatuh di baris 3, anchor 80% jatuh di baris 4. Bidak di
    baris 4 (dasarnya menyentuh petak 4). Versi lama (tengah kotak) salah
    ke baris 3; anchor benar di baris 4. Inilah bug 'wrong squares'."""
    grid = (0.0, 0.0, float(SQ), 1.0)
    h = 2.0 * SQ
    y1 = 2.5 * SQ
    anchor_y = y1 + h * 0.8    # 4.1 -> baris 4 (BENAR)
    center_y = y1 + h * 0.5    # 3.5 -> baris 3 (SALAH)

    bfen_a = S.grid_fen([("K", 4.5 * SQ, anchor_y, h, 0.95)], grid)
    assert "K" in bfen_a.split("/")[4], f"anchor harus baris 4, dapat {bfen_a}"
    print(f"  OK anchor bidak tinggi -> baris 4 (BENAR): {bfen_a}")

    bfen_c = S.grid_fen([("K", 4.5 * SQ, center_y, h, 0.95)], grid)
    assert "K" in bfen_c.split("/")[3], f"tengah kotak harus baris 3, dapat {bfen_c}"
    print(f"  OK tengah kotak -> baris 3 (BUG LAMA): {bfen_c}")

    # Bidak pendek: anchor tidak boleh meleset ke baris berikutnya.
    h2 = 0.5 * SQ
    y1b = 6.3 * SQ
    anchor_b = y1b + h2 * 0.8    # 6.7 -> baris 6
    bfen_b = S.grid_fen([("P", 4.5 * SQ, anchor_b, h2, 0.95)], grid)
    assert "P" in bfen_b.split("/")[6], f"pion pendek harus baris 6, dapat {bfen_b}"
    print(f"  OK anchor bidak pendek -> baris 6: {bfen_b}")


def main():
    print("test calibrate_grid:")
    test_calibrate_shape()
    print("test checkerboard tidak menentukan orientasi:")
    test_checkerboard_cannot_give_orientation()
    print("test orient_from_detections:")
    test_orientation_from_colors()

    test_orientation_uncertain_returns_none()
    print("test grid_fen anchoring:")
    test_grid_fen_anchors_piece_base()
    print("\nSemua check LULUS.")


if __name__ == "__main__":
    main()