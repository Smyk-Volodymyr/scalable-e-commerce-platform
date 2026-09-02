import express from "express";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { categoriesRouter } from "./modules/products/categories.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { reservationsRouter } from "./modules/reservations/reservations.routes.js";
import { startExpiryJob } from "./jobs/expire-reservations.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "product-service" });
}); 

app.get("/health/db", async (_req, res) => {
  const result = await pool.query("SELECT now() AS time");
  res.json({ status: "ok", dbTime: result.rows[0].time });
});

app.use("/categories", categoriesRouter);
app.use("/products", productsRouter);
app.use("/internal/reservations", reservationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  await pool.query("SELECT 1");
  console.log("Підключення до БД встановлено");

  const server = app.listen(env.PORT, () => {
    console.log(`product-service працює на http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  startExpiryJob();
  console.log("Фонове звільнення резервів запущено");

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