import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectRedis } from "./db/redis.js";

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
