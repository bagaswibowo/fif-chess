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

@app.get("/health")
def health():
    return {"status": "ok", "service": "chesscog", "models_loaded": recognizer is not None}

@app.post("/predict")
def predict(req: ScanRequest):
    if recognizer is None:
        raise HTTPException(status_code=500, detail="Chesscog recognizer model is not initialized")
    try:
        data = req.image
        if "base64," in data:
            data = data.split("base64,")[1]
        img_bytes = base64.b64decode(data)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_np = np.array(img)

        # Pre-process: enhance contrast natively (Elucidation inspired) for robust line/corner isolation
        lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
        lab[..., 0] = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8)).apply(lab[..., 0])
        img_np = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)

        turn = chess.WHITE if req.turn.lower() == "white" else chess.BLACK
        board, corners = recognizer.predict(img_np, turn=turn)

        fen = board.fen()
        board_fen = board.board_fen()

        return {
            "ok": True,
            "fen": fen,
            "board_fen": board_fen,
            "corners": corners.tolist() if hasattr(corners, "tolist") else str(corners),
        }
    except Exception as e:
        logger.error(f"Prediction failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error processing chessboard image")
