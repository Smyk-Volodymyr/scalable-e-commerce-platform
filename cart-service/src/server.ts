import express from "express";
import { env } from "./config/env.js";
import { connectRedis, redis } from "./db/redis.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { cartRouter } from "./modules/cart/cart.routes.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "cart-service" });
});

app.use("/cart", cartRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  await connectRedis();
  console.log("Підключення до Redis встановлено");
  app.listen(env.PORT, () => {
    console.log(`cart-service працює на http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });
}

start().catch((err) => {
  console.error("Не вдалося запустити сервіс:", err);
  process.exit(1);
});