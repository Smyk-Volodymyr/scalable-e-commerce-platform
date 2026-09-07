// Точка входу @shop/shared/db. Тягне за собою pg — тому окремо від /errors і /http.
export { createPool } from "./pool.js";
export type { Db } from "./pool.js";
export { runMigrations } from "./migrate.js";
