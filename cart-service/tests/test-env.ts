// Один-єдиний джерело правди про оточення тестів: його читає vitest.config.ts і
// передає в процес воркера ДО того, як src/config/env.ts провалідує змінні через zod
// і зробить process.exit(1) на першій відсутній.
// dotenv у config/env.ts не перезаписує вже наявні змінні, тож значення звідси
// перекривають cart-service/.env з робочими налаштуваннями.
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  // Не 0: zod у config/env.ts вимагає positive(), і PORT=0 валить процес ще до тестів.
  // Значення все одно не використовується — supertest піднімає app без listen.
  PORT: "3003",
  // Саме база 1: застосунок працює в базі 0 тієї ж інстанції, а setup.ts робить
  // flushDb() перед кожним тестом — на базі 0 це стерло б реальні кошики.
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6380/1",
  JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-at-least-32-characters-long",
  // Реальних запитів туди немає: products.client замокано у кожному тестовому файлі.
  // Змінна потрібна лише щоб пройшла zod-валідація .url().
  PRODUCT_SERVICE_URL: process.env.PRODUCT_SERVICE_URL ?? "http://localhost:3002",
  CART_TTL_DAYS: process.env.CART_TTL_DAYS ?? "30",
};
