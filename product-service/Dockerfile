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
      --workspace @shop/shared --workspace product-service

COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src
RUN npm run build --workspace @shop/shared

COPY product-service/tsconfig.json product-service/
COPY product-service/src product-service/src
RUN npm run build --workspace product-service

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
      --workspace @shop/shared --workspace product-service \
    && npm cache clean --force

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/product-service/dist product-service/dist
COPY product-service/migrations product-service/migrations

USER node

# cwd — каталог сервісу: саме відносно нього шукаються migrations/*.sql.
WORKDIR /app/product-service

EXPOSE 3002

CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
