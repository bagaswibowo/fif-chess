# jev-chess — multi-stage Docker build (custom server.ts entry, realtime WS)
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# include dev deps: tailwind/postcss needed at build time; NODE_ENV=production set after install
RUN npm ci --include=dev
ENV NODE_ENV=production
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=43173
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends stockfish && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/models ./models
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/lib ./lib
RUN rm -f /app/.env
EXPOSE 43173
# entry via Next custom server (ws attach) — see ADR-001
CMD ["node", "--experimental-strip-types", "server.ts"]
