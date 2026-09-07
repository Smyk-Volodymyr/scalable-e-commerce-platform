import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { TEST_ENV } from "./test-env.js";

// Шлях рахуємо від самого файлу, а не від process.cwd(): globalSetup
// виконується vitest-ом, і робочий каталог процесу тут не гарантований.
const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));

export default async function globalSetup(): Promise<void> {
  const url = new URL(TEST_ENV.DATABASE_URL!);
  const dbName = decodeURIComponent(url.pathname.slice(1));

  // Захист від випадкового прогону по робочій базі: TRUNCATE у setup.ts і
  // DROP SCHEMA нижче знищили б реальні дані без жодного попередження.
  if (!dbName.endsWith("_test")) {
    throw new Error(`Тестова БД має закінчуватись на "_test", отримано "${dbName}"`);
  }

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/postgres";

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (rowCount === 0) {
      // Ім'я БД не можна передати параметром — воно вже перевірене регуляркою вище.
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  const db = new pg.Client({ connectionString: TEST_ENV.DATABASE_URL });
  await db.connect();
  try {
    // Чистий старт: прогін не має залежати від залишків попереднього запуску
    // чи від міграцій, які встигли змінитись між запусками.
    await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await db.query("BEGIN");
      try {
        await db.query(sql);
        await db.query("COMMIT");
      } catch (err) {
        await db.query("ROLLBACK");
        throw new Error(`Міграція ${file} впала: ${(err as Error).message}`);
      }
    }
  } finally {
    // Без цього vitest не завершиться: відкритий клієнт тримає event loop.
    await db.end();
  }
}
