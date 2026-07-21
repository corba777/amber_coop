# ---- build stage -----------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci

COPY client ./client
COPY server ./server
COPY shared ./shared
COPY test ./test
COPY persona ./persona
COPY scripts-build.mjs tsconfig.json ./

RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "dist/server.js"]
