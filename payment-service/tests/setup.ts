import { afterAll, beforeEach, vi } from "vitest";
import { pool } from "../src/db/pool.js";

beforeEach(async () => {
  // Лічильники викликів моків не мають текти між тестами — на них тримається
  // головна перевірка ідемпотентності вебхука (markPaid рівно один раз).
  vi.clearAllMocks();

  // Список таблиць беремо динамічно, щоб не оновлювати його руками після
  // кожної нової міграції.
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT table_name AS tablename FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  if (rows.length === 0) return;

  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  // Пул той самий, яким користується застосунок; без end() vitest висітиме.
  await pool.end();
});
