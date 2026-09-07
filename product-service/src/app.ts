import express from "express";
import { pool } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { categoriesRouter } from "./modules/products/categories.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";
import { reservationsRouter } from "./modules/reservations/reservations.routes.js";

// Застосунок без listen(): так його можна віддати supertest без підняття порту
// і без RabbitMQ та фонових джобів, які потрібні тільки реальному процесу.
export const app = express();
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
