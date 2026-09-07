import { afterAll, beforeAll, beforeEach } from "vitest";
import { connectRedis, redis } from "../src/db/redis.js";

// Той самий клієнт, яким користується застосунок: підключаємо його один раз на
// файл, бо репозиторій кошика ходить саме через нього.
beforeAll(async () => {
  await connectRedis();
});

// Клієнт підключений до бази 1 (див. tests/test-env.ts), тож flushDb чистить
// лише тестові дані.
beforeEach(async () => {
  await redis.flushDb();
});

// Без закриття з'єднання vitest не завершить процес — сокет тримає event loop.
afterAll(async () => {
  await redis.quit();
});
