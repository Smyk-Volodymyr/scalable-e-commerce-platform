import { runMigrations } from "@shop/shared/db";
import { pool } from "./pool.js";

runMigrations(pool)
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
