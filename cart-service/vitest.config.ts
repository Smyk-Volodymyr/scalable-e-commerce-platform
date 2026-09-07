import { defineConfig } from "vitest/config";
import { TEST_ENV } from "./tests/test-env.js";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Усі тестові файли працюють з однією базою Redis і чистять її між тестами.
    // Паралельний прогін означав би, що один файл робить flushDb(),
    // поки інший читає власний кошик.
    fileParallelism: false,
    // globalSetup не потрібен: сховище — Redis, міграцій і створення БД немає.
    setupFiles: ["tests/setup.ts"],
    env: TEST_ENV,
  },
});
