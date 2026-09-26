FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# .env tidak boleh masuk image; secret lewat docker compose environment.
RUN find . -name '.env*' ! -name '.env.example' -delete
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=43173
ENV HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends stockfish && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/models ./models

# Standalone occasionally carries .env through; strip it from the runtime image.
RUN rm -f /app/.env

EXPOSE 43173
CMD ["node", "server.js"]
