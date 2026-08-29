import express from "express";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { categoriesRouter } from "./modules/products/categories.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "product-service" });
});

app.use("/categories", categoriesRouter);
app.use("/products", productsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  await pool.query("SELECT 1");
  console.log("Підключення до БД встановлено");
  app.listen(env.PORT, () => {
    console.log(`product-service працює на http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });
}

start().catch((err) => {
  console.error("Не вдалося запустити сервіс:", err);
  process.exit(1);
});
