import { afterAll, beforeEach } from "vitest";
import { pool } from "../src/db/pool.js";

// Той самий пул, яким користується застосунок: інакше застосунок тримав би власні
// з'єднання, які ніхто не закриє, і vitest висів би після останнього тесту.

beforeEach(async () => {
  const { rows } = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  if (rows.length === 0) return;

  // Список таблиць беремо динамічно, щоб нова міграція не вимагала правки цього файлу.
  // Один TRUNCATE на всі таблиці: CASCADE знімає проблему FK-порядку між
  // users і refresh_tokens.
  const tables = rows.map((r) => `"${r.table_name}"`).join(", ");
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await pool.end();
});
