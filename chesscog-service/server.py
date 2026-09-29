import io
import base64
import logging
import numpy as np
import cv2
from PIL import Image
import chess
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from chesscog.recognition import ChessRecognizer
from chesscog.core.exceptions import ChessboardNotLocatedException
from chesscog.corner_detection.opencv_fallback import find_board_homography, IMG_SIZE
from chesscog.corner_detection.occupancy_cv import occupancy_cv, estimate_piece_colors
from chesscog.occupancy_classifier import create_dataset as create_occupancy_dataset
from chesscog.piece_classifier import create_dataset as create_piece_dataset

logger = logging.getLogger("chesscog-server")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Chesscog FEN Recognition API")

print("Loading Chesscog models into memory...")
try:
    recognizer = ChessRecognizer()
    print("Chesscog models loaded successfully!")
except Exception as e:
    print(f"Failed to load Chesscog recognizer: {e}")
    recognizer = None


class ScanRequest(BaseModel):
    image: str
    turn: str = "white"
    # True bila gambar sudah di-warp jadi persegi oleh client (PerspectiveCropModal
    # 800x800) — papan bisa dibaca tanpa deteksi papan sama sekali.
    prewarped: bool = False


@app.get("/health")
def health():
    return {"status": "ok", "service": "chesscog", "models_loaded": recognizer is not None}


def _to_rgb(img_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img)


def _clahe(img_np: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
    lab[..., 0] = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lab[..., 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


def _occupancy_and_pieces(warped: np.ndarray, turn: chess.Color):
    """Klasifikasi bidak memakai model chesscog pada papan hasil warp."""

    import torch
    from PIL import Image as PILImage
    from chesscog.core import device, DEVICE
    from chesscog.core.dataset import build_transforms, Datasets
    from chesscog.core.dataset import name_to_piece

    squares = list(chess.SQUARES)
    occupancy_list = [create_occupancy_dataset.crop_square(warped, turn=turn, square=sq)
                      for sq in squares]

    occ_cfg, occ_model = recognizer._occupancy_cfg, recognizer._occupancy_model
    pcs_cfg, pcs_model = recognizer._pieces_cfg, recognizer._pieces_model
    occ_transforms = build_transforms(occ_cfg, mode=Datasets.TEST)
    pcs_transforms = build_transforms(pcs_cfg, mode=Datasets.TEST)
    piece_classes = np.array(list(map(name_to_piece, pcs_cfg.DATASET.CLASSES)))

    with torch.no_grad():
        occ_imgs = torch.stack([occ_transforms(PILImage.fromarray(c)) for c in occupancy_list])
        occ_imgs = device(occ_imgs)
        model_occ = occ_model(occ_imgs).argmax(axis=-1) == occ_cfg.DATASET.CLASSES.index("occupied")
        model_occ = model_occ.cpu().numpy()

        # Gabungkan dengan occupancy CV klasik (ala Chess-Tracker) — model
        # sering melewatkan bidak putih gading di petak krem pada papan hijau.
        occupancy = occupancy_cv(warped, turn, model_occ)

        occupied_squares = np.array(squares)[occupancy]
        pcs_imgs = [create_piece_dataset.crop_square(warped, turn=turn, square=sq)
                    for sq in occupied_squares]
        if len(pcs_imgs) > 0:
            pcs_tensor = torch.stack([pcs_transforms(PILImage.fromarray(c)) for c in pcs_imgs])
            pcs_tensor = device(pcs_tensor)
            pieces = pcs_model(pcs_tensor).argmax(axis=-1).cpu().numpy()
            pieces = piece_classes[pieces]
            pieces = np.asarray(pieces, dtype=object)
            # Perbaiki warna bidak via kecerahan CV — piece classifier model
            # kadang salah warna untuk bidak gading/petak krem.
            is_white = estimate_piece_colors(warped, turn, occupancy)[occupancy]
            fixed = []
            for p, w in zip(pieces, is_white):
                if p is None:
                    fixed.append(p)
                    continue
                correct_color = chess.WHITE if w else chess.BLACK
                fixed.append(chess.Piece(p.piece_type, correct_color))
            pieces = fixed
        else:
            pieces = np.array([], dtype=object)

        all_pieces = np.full(len(squares), None, dtype=object)
        all_pieces[occupancy] = pieces
    return all_pieces


def _detect_turn_from_warped(warped: np.ndarray) -> chess.Color:
    """Deteksi orientasi papan: petak a8 harus gelap.
    Setelah warp, gambar berorientasi a8-kiri-atas JIKA foto dari sisi putih;
    kalau foto dari sisi hitam, petak terang/gelap akan terbalik.
    Bandingkan kecerahan petak kiri-atas vs kanan-atas area papan:
    a8 gelap = orientasi putih (turn WHITE); sebaliknya = BLACK.
    """
    sq = MARGIN // 2  # petak 50px dalam gambar 500 (papan 400 + margin 50)
    a8_x0, a8_y0 = MARGIN, MARGIN
    h8_x0, h8_y0 = MARGIN + BOARD_SIZE - sq, MARGIN
    a8 = warped[a8_y0 + sq // 4: a8_y0 + sq - sq // 4,
                a8_x0 + sq // 4: a8_x0 + sq - sq // 4].mean()
    h8 = warped[h8_y0 + sq // 4: h8_y0 + sq - sq // 4,
                h8_x0: h8_x0 + sq - sq // 2].mean()
    return chess.WHITE if a8 < h8 else chess.BLACK


def _predict_with_fallback(img: np.ndarray, req_turn: str, req_prewarped: bool = False):
    """Pipeline lengkap: chesscog RANSAC dulu; kalau gagal, fallback OpenCV."""
    errors = []

    # 1. Pipeline chesscog utama
    if recognizer is not None:
        try:
            from chesscog.corner_detection import find_corners
            from chesscog.corner_detection.detect_corners import resize_image as _resize

            cfg = recognizer._corner_detection_cfg
            img_scaled, img_scale = _resize(cfg, img)
            corners = find_corners(cfg, img_scaled)
            board = chess.Board()
            board.clear_board()
            occupancy = recognizer._classify_occupancy(img_scaled, chess.WHITE, corners)
            pieces = recognizer._classify_pieces(img_scaled, chess.WHITE, corners, occupancy)
            for square, piece in zip(list(chess.SQUARES), pieces):
                if piece:
                    board.set_piece_at(square, piece)
            logger.info("chesscog RANSAC pipeline sukses")
            return board, "chesscog-cv"
        except Exception as e:
            errors.append(f"RANSAC: {type(e).__name__}: {e}")
            logger.warning("Corner detection RANSAC gagal: %s", e)

    # 2b. Gambar sudah persegi dari client crop -> baca papan langsung.
    if req_prewarped:
        try:
            warped = cv2.resize(img, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
            turn = _detect_turn_from_warped(warped) if req_turn == "auto" else (
                chess.WHITE if req_turn.lower() == "white" else chess.BLACK)
            all_pieces = _occupancy_and_pieces(warped, turn)
            board = chess.Board()
            board.clear_board()
            for square, piece in zip(list(chess.SQUARES), all_pieces):
                if piece:
                    board.set_piece_at(square, piece)
            logger.info("prewarped direct-read sukses (turn=%s)", "white" if turn else "black")
            return board, "prewarped-direct"
        except Exception as e:
            errors.append(f"prewarped: {type(e).__name__}: {e}")
            logger.warning("Prewarped direct read gagal: %s", e)

    # 2. Fallback murni OpenCV (ala ChessboardDetect) + classifier chesscog
    try:
        M = find_board_homography(img)
        warped = cv2.warpPerspective(img, M, (IMG_SIZE, IMG_SIZE), flags=cv2.INTER_LINEAR)
        turn = _detect_turn_from_warped(warped) if req_turn == "auto" else (
            chess.WHITE if req_turn.lower() == "white" else chess.BLACK)
        all_pieces = _occupancy_and_pieces(warped, turn)

        board = chess.Board()
        board.clear_board()
        for square, piece in zip(list(chess.SQUARES), all_pieces):
            if piece:
                board.set_piece_at(square, piece)
        logger.info("fallback OpenCV homography sukses (turn=%s)", "white" if turn else "black")
        return board, "opencv-fallback"
    except Exception as e:
        errors.append(f"opencv_fallback: {type(e).__name__}: {e}")
        logger.warning("Fallback OpenCV gagal: %s", e)

    raise HTTPException(
        status_code=422,
        detail="Papan catur tidak dapat ditemukan dalam foto. "
               + " | ".join(errors)
               + " Coba: foto lebih tegak lurus, pencahayaan merata, atau crop manual di aplikasi."
    )


@app.post("/predict")
def predict(req: ScanRequest):
    if recognizer is None:
        raise HTTPException(status_code=500, detail="Chesscog recognizer model is not initialized")
    try:
        data = req.image
        if "base64," in data:
            data = data.split("base64,")[1]
        img_bytes = base64.b64decode(data)
        img = _to_rgb(img_bytes)
        img = _clahe(img)

        board, engine = _predict_with_fallback(img, req.turn or "white", req.prewarped)
        fen = board.fen()
        board_fen = board.board_fen()
        return {
            "ok": True,
            "fen": fen,
            "board_fen": board_fen,
            "engine": engine,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error processing chessboard image")
