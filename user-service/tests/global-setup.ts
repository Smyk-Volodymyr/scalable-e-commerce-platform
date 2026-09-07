import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { TEST_ENV } from "./test-env.js";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../migrations");

export default async function setup(): Promise<void> {
  const url = new URL(TEST_ENV.DATABASE_URL!);
  const dbName = decodeURIComponent(url.pathname.slice(1));

  // Захист від випадкового прогону по робочій базі: TRUNCATE у tests/setup.ts
  // і DROP SCHEMA нижче знищили б реальні дані.
  if (!dbName.endsWith("_test")) {
    throw new Error(`Тести відмовляються працювати з базою "${dbName}": ім'я має закінчуватись на _test`);
  }

  // CREATE DATABASE не можна виконати всередині бази, яку ще не створено,
  // тож спершу підключаємось до службової "postgres".
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (rowCount === 0) {
      // Ідентифікатор не можна передати параметром, тому екрануємо лапки вручну.
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.end();
  }

  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    // Чистий старт: схема могла лишитись від попереднього прогону зі старим набором
    // міграцій, і тоді нові міграції лягли б поверх чужого стану.
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      // Кожна міграція — своя транзакція: часткове застосування залишило б базу
      // у стані, який неможливо діагностувати з падіння тесту.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Міграція ${file} не застосувалась: ${(err as Error).message}`);
      }
    }
  } finally {
    // Без цього vitest не завершить процес після останнього тесту.
    await client.end();
  }
}
