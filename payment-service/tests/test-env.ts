// Один-єдиний источник правди про оточення тестів: його читає і vitest.config.ts,
// і global-setup.ts, який виконується поза контекстом test.env.
// Дефолти — локальний Docker; перевизначення через process.env знадобиться в CI.
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  // Не "0": zod у src/config/env.ts вимагає positive(). Значення все одно
  // не використовується — у тестах listen() не викликається, supertest
  // піднімає власний ефемерний порт.
  PORT: "3005",
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgres://shop:shop@localhost:5436/payment_service_test",
  JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-at-least-32-characters-long",
  ORDER_SERVICE_URL: process.env.ORDER_SERVICE_URL ?? "http://localhost:3004",
  // zod у src/config/env.ts вимагає саме ці префікси, інакше сервіс робить process.exit(1).
  // Ключі фейкові: Stripe SDK у тестах замоканий і по мережі не ходить.
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "sk_test_fake_key_for_integration_tests",
  STRIPE_WEBHOOK_SECRET:
    process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_fake_secret_for_integration_tests",
};
