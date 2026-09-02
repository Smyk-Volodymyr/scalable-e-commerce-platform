import express from "express";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { webhook } from "./modules/payments/payments.controller.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";

const app = express();

app.post("/payments/webhook", express.raw({ type: "application/json" }), webhook);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "payment-service" });
});

app.use("/payments", paymentsRouter);

app.get("/health/db", async (_req, res) => {
  const result = await pool.query("SELECT now() AS time");
  res.json({ status: "ok", dbTime: result.rows[0].time });
});

app.use(notFoundHandler);
app.use(errorHandler);

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