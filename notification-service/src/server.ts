import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { closeRabbit, connectRabbit } from "./lib/rabbit.js";
import { startOrderConsumer } from "./consumers/order.consumer.js";

async function start() {
  await pool.query("SELECT 1");
  console.log("Підключення до БД встановлено");

  await connectRabbit();
  console.log("Підключення до RabbitMQ встановлено");

  await startOrderConsumer();

  const server = app.listen(env.PORT, () => {
    console.log(`notification-service працює на порту ${env.PORT} [${env.NODE_ENV}]`);
  });

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      console.log(`${signal} — завершуюсь`);
      server.close(async () => {
        await closeRabbit();
        await pool.end();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    });
  }
}

start().catch((err) => {
  console.error("Не вдалося запустити сервіс:", err);
  process.exit(1);
});
