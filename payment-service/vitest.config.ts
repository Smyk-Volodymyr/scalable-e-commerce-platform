import { defineConfig } from "vitest/config";
import { TEST_ENV } from "./tests/test-env.js";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Усі тестові файли працюють з однією тестовою БД і чистять її між тестами.
    // Паралельний прогін файлів означав би, що один файл робить TRUNCATE,
    // поки інший читає власні дані.
    fileParallelism: false,
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    env: TEST_ENV,
  },
});
