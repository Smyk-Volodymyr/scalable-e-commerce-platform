import { afterAll, beforeEach } from "vitest";
import { pool } from "../src/db/pool.js";

beforeEach(async () => {
  // Список таблиць беремо з каталогу, а не руками: після нової міграції
  // нічого не треба дописувати. RESTART IDENTITY CASCADE знімає й FK-звʼязки.
  const { rows } = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );

  if (rows.length === 0) return;

  const tables = rows.map((r) => `public."${r.table_name}"`).join(", ");
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  // Пул той самий, яким користується застосунок; без end() vitest висітиме.
  await pool.end();
});
