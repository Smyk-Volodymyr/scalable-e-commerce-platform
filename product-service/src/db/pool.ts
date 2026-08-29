import pg from "pg";
import { env } from "../config/env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,                     
  idleTimeoutMillis: 30_000,    
  connectionTimeoutMillis: 5_000, 
});

pool.on("error", (err) => {
  console.error("Несподівана помилка на з'єднанні з БД:", err);
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query<T>(text, params as never);
  return result.rows;
}


