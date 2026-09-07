import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

async function start() {
  await pool.query("SELECT 1");
  console.log("Підключення до БД встановлено");

  const server = app.listen(env.PORT, () => {
    console.log(`payment-service працює на http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      console.log(`${signal} — завершуюсь`);
      server.close(async () => {
        await pool.end();
        console.log("Завершено коректно");
        process.exit(0);
      });
      setTimeout(() => {
        console.error("Не встиг завершитись за 10с, вихід примусово");
        process.exit(1);
      }, 10_000).unref();
    });
  }
}

start().catch((err) => {
  console.error("Не вдалося запустити сервіс:", err);
  process.exit(1);
});
