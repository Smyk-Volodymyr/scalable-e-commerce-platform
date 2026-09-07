import pg from "pg";

export interface Db {
  pool: pg.Pool;
  query<T extends pg.QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
  withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T>;
}

// Фабрика, а не готовий пул: рядок підключення приходить зі схеми оточення
// конкретного сервісу. Модуль-обгортка в сервісі створює пул один раз і
// експортує його далі, тож усі наявні місця імпорту лишаються незмінними.
export function createPool(connectionString: string): Db {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Помилка простоюючого з'єднання приходить сюди, а не в await якогось запиту.
  // Без цього обробника вона стала б необробленою подією і поклала б процес.
  pool.on("error", (err) => {
    console.error("Несподівана помилка на з'єднанні з БД:", err);
  });

  async function query<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await pool.query<T>(text, params as never);
    return result.rows;
  }

  async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      // release саме у finally: без нього невдала транзакція назавжди забирала б
      // з'єднання з пулу, і через max=10 таких помилок сервіс просто застигав би.
      client.release();
    }
  }

  return { pool, query, withTransaction };
}
