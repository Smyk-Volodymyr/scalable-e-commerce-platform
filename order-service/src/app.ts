import express from "express";
import { pool } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "@shop/shared/http";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { ordersInternalRouter } from "./modules/orders/orders.internal.routes.js";

// Застосунок без listen: так його можна підняти в тестах через supertest,
// не займаючи порт і не тягнучи за собою RabbitMQ та публікатор outbox.
export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "order-service" });
});

app.get("/health/db", async (_req, res) => {
  const result = await pool.query("SELECT now() AS time");
  res.json({ status: "ok", dbTime: result.rows[0].time });
});

app.use("/orders", ordersRouter);

app.use("/internal/orders", ordersInternalRouter);

app.use(notFoundHandler);
app.use(errorHandler);
