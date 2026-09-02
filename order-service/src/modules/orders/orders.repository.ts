import type pg from "pg";
import { query } from "../../db/pool.js";

export interface OrderRow {
  id: string;
  user_id: string;
  status: string;
  total_cents: number;
  currency: string;
  reservation_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItemRow {
  order_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  unit_price_cents: number;
  quantity: number;
}

export async function findByIdempotencyKey(key: string, userId: string): Promise<string | undefined> {
  const rows = await query<{ order_id: string }>(
    "SELECT order_id FROM idempotency_keys WHERE key = $1 AND user_id = $2",
    [key, userId],
  );
  return rows[0]?.order_id;
}

export async function findById(id: string): Promise<OrderRow | undefined> {
  const rows = await query<OrderRow>("SELECT * FROM orders WHERE id = $1", [id]);
  return rows[0];
}

export async function findByUser(userId: string, limit: number, offset: number): Promise<OrderRow[]> {
  return query<OrderRow>(
    "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    [userId, limit, offset],
  );
}

export async function getItems(orderId: string): Promise<OrderItemRow[]> {
  return query<OrderItemRow>("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
}

export async function insertOrder(
  client: pg.PoolClient,
  data: { id: string; userId: string; totalCents: number; currency: string; reservationId: string },
): Promise<OrderRow> {
  const { rows } = await client.query<OrderRow>(
    `INSERT INTO orders (id, user_id, total_cents, currency, reservation_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.id, data.userId, data.totalCents, data.currency, data.reservationId],
  );
  return rows[0]!;
}

export async function insertItems(
  client: pg.PoolClient,
  orderId: string,
  items: { productId: string; name: string; slug: string; priceCents: number; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    await client.query(
      `INSERT INTO order_items
       (order_id, product_id, product_name, product_slug, unit_price_cents, quantity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, item.productId, item.name, item.slug, item.priceCents, item.quantity],
    );
  }
}

export async function insertIdempotencyKey(
  client: pg.PoolClient,
  key: string,
  userId: string,
  orderId: string,
): Promise<void> {
  await client.query(
    "INSERT INTO idempotency_keys (key, user_id, order_id) VALUES ($1, $2, $3)",
    [key, userId, orderId],
  );
}

export async function setStatus(id: string, status: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING id",
    [id, status],
  );
  return rows.length > 0;
}