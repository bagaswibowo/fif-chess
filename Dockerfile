# jev-chess — multi-stage Docker build
# Stage 1: build the Next.js app (standalone output)
FROM node:20-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 2: runner — lean production image
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=43173
ENV HOSTNAME=0.0.0.0

# Stockfish binary for engine moves
RUN apt-get update && apt-get install -y --no-install-recommends stockfish && rm -rf /var/lib/apt/lists/*

# Standalone output already bundles production node_modules + server.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/models ./models

# Never ship a .env into the image; secrets come from the host at runtime
RUN rm -f /app/.env

EXPOSE 43173
CMD ["node", "server.js"]
