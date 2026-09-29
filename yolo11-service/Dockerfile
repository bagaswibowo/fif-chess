FROM python:3.11-slim

WORKDIR /app

# OpenCV & numpy perlu lib system; curl untuk unduh model otomatis
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Folder model (diisi otomatis oleh entrypoint bila kosong)
RUN mkdir -p /app/models

EXPOSE 8100

CMD ["./entrypoint.sh"]
