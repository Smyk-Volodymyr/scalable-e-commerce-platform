import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { TEST_ENV } from "./test-env.js";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../migrations");

// src/db/migrate.ts не імпортуємо навмисно: це самовиконуваний скрипт із process.exit,
// імпорт убив би процес vitest.
export default async function setup(): Promise<void> {
  const url = new URL(TEST_ENV.DATABASE_URL!);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  // Запобіжник від прогону тестів (а отже й TRUNCATE) по робочій базі.
  if (!dbName.endsWith("_test")) {
    throw new Error(`Тестова БД має закінчуватись на "_test", отримано "${dbName}"`);
  }

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    // CREATE DATABASE не приймає параметрів, тому ім'я екрануємо вручну.
    if (rowCount === 0) await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }

  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  try {
    // Чистий старт: прогін не повинен залежати від залишків попереднього.
    await db.query("DROP SCHEMA public CASCADE");
    await db.query("CREATE SCHEMA public");

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await db.query("BEGIN");
      try {
        await db.query(sql);
        await db.query("COMMIT");
      } catch (err) {
        await db.query("ROLLBACK");
        throw new Error(`Міграція ${file} впала: ${String(err)}`);
      }
    }
  } finally {
    // Без явного закриття vitest не завершиться сам.
    await db.end();
  }
}
