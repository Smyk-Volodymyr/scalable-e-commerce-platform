import { afterAll, beforeEach, vi } from "vitest";
import { pool } from "../src/db/pool.js";

beforeEach(async () => {
  // Лічильники викликів моків не повинні текти між тестами:
  // на них тримається головна перевірка ідемпотентності checkout.
  vi.clearAllMocks();

  // Список таблиць беремо динамічно, щоб не правити його руками після кожної міграції.
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT table_name AS tablename FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  if (rows.length === 0) return;

  const list = rows.map((r) => `public."${r.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  // Той самий пул, яким користується застосунок; без end() vitest висітиме.
  await pool.end();
});
