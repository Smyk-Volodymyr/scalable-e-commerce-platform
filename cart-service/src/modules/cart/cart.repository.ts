import { redis } from "../../db/redis.js";
import { env } from "../../config/env.js";

const TTL_SECONDS = env.CART_TTL_DAYS * 24 * 60 * 60;

const key = (userId: string) => `cart:${userId}`;

export async function getItems(userId: string): Promise<Record<string, number>> {
  const raw = await redis.hGetAll(key(userId));
  const items: Record<string, number> = {};
  for (const [productId, qty] of Object.entries(raw)) {
    items[productId] = Number(qty);
  }
  return items;
}

export async function setItem(userId: string, productId: string, qty: number): Promise<void> {
  const k = key(userId);
  await redis.hSet(k, productId, String(qty));
  await redis.expire(k, TTL_SECONDS);
}

export async function removeItem(userId: string, productId: string): Promise<boolean> {
  const removed = await redis.hDel(key(userId), productId);
  return removed > 0;
}

export async function clear(userId: string): Promise<void> {
  await redis.del(key(userId));
}