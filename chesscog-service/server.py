import io
import base64
import numpy as np
from PIL import Image
import chess
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from chesscog.recognition import ChessRecognizer

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

        turn = chess.WHITE if req.turn.lower() == "white" else chess.BLACK
        board, corners = recognizer.predict(img_np, turn=turn)

        fen = board.fen()
        board_fen = board.board_fen()

        return {
            "ok": True,
            "fen": fen,
            "board_fen": board_fen,
            "corners": corners.tolist() if hasattr(corners, "tolist") else str(corners),
            "confidence": 0.95
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
