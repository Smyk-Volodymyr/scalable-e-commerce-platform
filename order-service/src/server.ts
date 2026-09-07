import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { closeRabbit, connectRabbit } from "./lib/rabbit.js";
import { startOutboxPublisher } from "./jobs/outbox-publisher.js";

async function start() {
  await pool.query("SELECT 1");
  console.log("Підключення до БД встановлено");

  await connectRabbit();
  console.log("Підключення до RabbitMQ встановлено");

  const server = app.listen(env.PORT, () => {
    console.log(`order-service працює на http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  startOutboxPublisher();
  console.log("Публікатор outbox запущено");

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      console.log(`${signal} — завершуюсь`);

      server.close(async () => {
        await closeRabbit();
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
