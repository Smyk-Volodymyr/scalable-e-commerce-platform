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
      --workspace @shop/shared --workspace payment-service

COPY packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src
RUN npm run build --workspace @shop/shared

COPY payment-service/tsconfig.json payment-service/
COPY payment-service/src payment-service/src
RUN npm run build --workspace payment-service

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
      --workspace @shop/shared --workspace payment-service \
    && npm cache clean --force

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/payment-service/dist payment-service/dist
COPY payment-service/migrations payment-service/migrations

USER node

# cwd — каталог сервісу: саме відносно нього шукаються migrations/*.sql.
WORKDIR /app/payment-service

EXPOSE 3005

CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
