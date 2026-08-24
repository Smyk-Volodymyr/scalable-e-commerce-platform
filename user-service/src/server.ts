import express from "express";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { authRouter, usersRouter } from "./modules/users/users.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "okk", service: "user-service" });
}); 

app.get("/health/db", async (_req, res) => {
  try {
    const result = await pool.query("SELECT now() AS time");
    res.json({ status: "ok", dbTime: result.rows[0].time });
  } catch (err) {
    console.error(err);
    res.status(503).json({ status: "error", message: "База недоступна" });
  }
})

app.use("/auth", authRouter);
app.use("/users", usersRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  await pool.query("SELECT 1");
  console.log("Підключення до БД встановлено");

  app.listen(env.PORT, () => {
    console.log(`user-service працює на http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });
}

start().catch((err) => {
  console.error("Не вдалося запустити сервіс:", err);
  process.exit(1);
});