FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    torch torchvision --extra-index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir \
    opencv-python-headless \
    fastapi \
    uvicorn \
    python-multipart \
    chess \
    pillow \
    numpy \
    scikit-learn \
    recap \
    pyyaml \
    googledrivedownloader \
    pandas \
    tqdm \
    matplotlib

ARG CACHE_BUST=3
COPY chesscog /app/chesscog
COPY config /app/config
COPY models /app/models
COPY server.py /app/server.py

ENV PYTHONPATH="/app:${PYTHONPATH}"
ENV DATA_DIR="/app/data"
ENV CONFIG_DIR="/app/config"
ENV MODELS_DIR="/app/models"

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
