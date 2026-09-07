// Один-єдиний джерело правди про оточення тестів: його читає і vitest.config.ts (через
// test.env для воркерів), і global-setup.ts, який виконується поза контекстом test.env.
// Перелічені ВСІ змінні, що їх вимагає src/config/env.ts — при провалі zod-схеми
// env.ts робить process.exit(1) і vitest падає без пояснення причини.
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  // Не 0: zod-схема в src/config/env.ts вимагає PORT .positive(), і на нулі
  // env.ts робить process.exit(1) ще до першого тесту. Саме значення ні на що не
  // впливає — supertest піднімає власний ефемерний сокет і env.PORT не читає.
  PORT: "3001",
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgres://shop:shop@localhost:5433/user_service_test",
  JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-at-least-32-characters-long",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "15m",
  REFRESH_TTL_DAYS: process.env.REFRESH_TTL_DAYS ?? "30",
  // Рівно 10 — це мінімум, який пропускає zod-схема (min(10)). Робочі 12 роблять
  // кожен bcrypt.hash/compare вчетверо повільнішим, а тестів з реєстрацією і логіном
  // тут десяток: прогін розтягується на десятки секунд без жодного виграшу в покритті.
  BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS ?? "10",
};
