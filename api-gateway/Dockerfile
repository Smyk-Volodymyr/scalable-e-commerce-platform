# ---------- Етап 1: збірка ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Контекст складання — корінь монорепозиторію, тому копіюємо маніфести ВСІХ
# воркспейсів: npm ci звіряє їх із кореневим package-lock.json і без будь-якого
# з них відмовляється ставити навіть один окремий сервіс.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY api-gateway/package.json api-gateway/
COPY cart-service/package.json cart-service/
COPY notification-service/package.json notification-service/
COPY order-service/package.json order-service/
COPY payment-service/package.json payment-service/
COPY product-service/package.json product-service/
COPY user-service/package.json user-service/

# --ignore-scripts: скрипт prepare у @shop/shared спробував би зібрати пакет
# ще до того, як його вихідники потраплять в образ. Збираємо явно, нижче.
RUN npm ci --ignore-scripts --include-workspace-root \
      --workspace api-gateway

COPY api-gateway/tsconfig.json api-gateway/
COPY api-gateway/src api-gateway/src
RUN npm run build --workspace api-gateway

# ---------- Етап 2: рантайм ----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY api-gateway/package.json api-gateway/
COPY cart-service/package.json cart-service/
COPY notification-service/package.json notification-service/
COPY order-service/package.json order-service/
COPY payment-service/package.json payment-service/
COPY product-service/package.json product-service/
COPY user-service/package.json user-service/

RUN npm ci --omit=dev --ignore-scripts --include-workspace-root \
      --workspace api-gateway \
    && npm cache clean --force

COPY --from=builder /app/api-gateway/dist api-gateway/dist

USER node

# cwd — каталог сервісу: саме відносно нього шукаються migrations/*.sql.
WORKDIR /app/api-gateway

EXPOSE 3000

CMD ["node", "dist/server.js"]
