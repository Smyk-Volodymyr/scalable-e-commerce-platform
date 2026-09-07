// Один-єдине джерело правди про оточення тестів: його читає і vitest.config.ts
// (через test.env), і global-setup.ts, який виконується поза контекстом test.env.
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  // Не "0", як в інших сервісах: тут zod вимагає PORT > 0 і робить process.exit(1).
  // Саме значення ні на що не впливає — app.ts не викликає listen().
  PORT: process.env.PORT ?? "3002",
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgres://shop:shop@localhost:5434/product_service_test",
  JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-at-least-32-characters-long",
  RESERVATION_TTL_MINUTES: process.env.RESERVATION_TTL_MINUTES ?? "15",
  // RABBITMQ_URL обовʼязковий у zod-схемі src/config/env.ts, інакше процес падає
  // з process.exit(1) ще до першого тесту. Реального зʼєднання не буде: connectRabbit()
  // і startOrderConsumer() живуть у server.ts, а тести піднімають лише app.ts.
  RABBITMQ_URL: process.env.RABBITMQ_URL ?? "amqp://shop:shop@localhost:5672",
};
