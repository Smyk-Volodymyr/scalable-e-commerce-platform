import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { closeRabbit, connectRabbit } from "./lib/rabbit.js";
import { startOrderConsumer } from "./consumers/order.consumer.js";
import { startExpiryJob } from "./jobs/expire-reservations.js";

async function start() {
  await pool.query("SELECT 1");
  console.log("Підключення до БД встановлено");

  await connectRabbit();
  console.log("Підключення до RabbitMQ встановлено");

  await startOrderConsumer();

  const server = app.listen(env.PORT, () => {
    console.log(`product-service працює на http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  startExpiryJob();
  console.log("Фонове звільнення резервів запущено");

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
