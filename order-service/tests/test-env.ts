// Один-єдиний источник правди про оточення тестів: його читає і vitest.config.ts,
// і global-setup, який виконується поза контекстом test.env.
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  // Не "0": схема в config/env.ts вимагає positive(). Порт усе одно не займається —
  // app.ts не робить listen, supertest піднімає сервер на випадковому порту сам.
  PORT: "3004",
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgres://shop:shop@localhost:5435/order_service_test",
  JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-at-least-32-characters-long",
  // Клієнти зовнішніх сервісів замокані, реальних запитів не буде,
  // але zod у config/env.ts вимагає саме валідні URL і без них робить process.exit(1).
  PRODUCT_SERVICE_URL: process.env.PRODUCT_SERVICE_URL ?? "http://localhost:3002",
  CART_SERVICE_URL: process.env.CART_SERVICE_URL ?? "http://localhost:3003",
  RABBITMQ_URL: process.env.RABBITMQ_URL ?? "amqp://shop:shop@localhost:5672",
};
