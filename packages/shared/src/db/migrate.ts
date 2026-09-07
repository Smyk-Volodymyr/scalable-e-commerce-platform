import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type pg from "pg";

// Каталог за замовчуванням рахується від cwd, а не від розташування цього файлу:
// у зібраному образі пакет лежить у packages/shared/dist, а міграції — поруч із
// сервісом, чий процес і задає cwd.
export async function runMigrations(
  pool: pg.Pool,
  migrationsDir: string = path.resolve(process.cwd(), "migrations"),
): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await pool.query<{ name: string }>("SELECT name FROM _migrations");
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("Нових міграцій немає");
    return;
  }

  for (const file of pending) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");

    const client = await pool.connect();
    try {
      // Сама міграція і відмітка про неї — в одній транзакції. Інакше падіння
      // між ними лишило б схему зміненою, але не позначеною як накочену.
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`✓ ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✗ ${file} — відкочено`);
      throw err;
    } finally {
      client.release();
    }
  }
}
