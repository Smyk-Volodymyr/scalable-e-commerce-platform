import { runMigrations } from "@shop/shared/db";
import { pool } from "./pool.js";

// Точка входу лишається в сервісі: саме її запускає CMD контейнера
// (node dist/db/migrate.js), а каталог migrations/ лежить поруч із сервісом.
runMigrations(pool)
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
