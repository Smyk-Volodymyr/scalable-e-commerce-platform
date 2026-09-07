import express from "express";
import { pool } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "@shop/shared/http";
import { authRouter, usersRouter } from "./modules/users/users.routes.js";

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "user-service" });
});

app.get("/health/db", async (_req, res) => {
  const result = await pool.query("SELECT now() AS time");
  res.json({ status: "ok", dbTime: result.rows[0].time });
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);

app.use(notFoundHandler);
app.use(errorHandler);
