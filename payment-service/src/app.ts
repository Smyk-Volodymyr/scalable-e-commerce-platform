import express from "express";
import { pool } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "@shop/shared/http";
import { webhook } from "./modules/payments/payments.controller.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";

export const app = express();

// Вебхук навмисно зареєстрований ДО express.json() і тримає власний express.raw().
// Stripe рахує підпис із заголовка stripe-signature по СИРИХ байтах тіла; якщо
// json-парсер відпрацює першим, у req.body опиниться вже розпарсений об'єкт,
// сирі байти будуть втрачені назавжди, і constructEvent почне падати на кожному
// запиті. Ці два рядки не можна міняти місцями.
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
