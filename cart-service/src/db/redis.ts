import { createClient } from "redis";
import { env } from "../config/env.js";

export const redis = createClient({ url: env.REDIS_URL });

redis.on("error", (err) => {
  console.error("Помилка Redis:", err);
});

export async function connectRedis(): Promise<void> {
  await redis.connect();
}