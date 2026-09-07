import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { TEST_ENV } from "./test-env.js";

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

export default async function globalSetup(): Promise<void> {
  const dbUrl = new URL(TEST_ENV.DATABASE_URL);
  const dbName = decodeURIComponent(dbUrl.pathname.replace(/^\//, ""));

  // Захист від випадкового прогону по робочій базі: DROP SCHEMA нижче незворотний.
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Тестова БД має закінчуватись на "_test", отримано "${dbName}". Прогін зупинено.`,
    );
  }

  const adminUrl = new URL(dbUrl.toString());
  adminUrl.pathname = "/postgres";

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      dbName,
    ]);
    // Ідентифікатор не параметризується, тому лапкуємо вручну; ім'я вже перевірене вище.
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  const db = new pg.Client({ connectionString: dbUrl.toString() });
  await db.connect();
  try {
    // Чистий старт: прогін не повинен залежати від залишків попереднього.
    await db.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
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
    // Без явного закриття vitest не завершиться сам.
    await db.end();
  }
}
