import type pg from "pg";
import { query } from "../../db/pool.js";

export interface ReservationRow {
  id: string;
  order_id: string;
  status: "active" | "committed" | "cancelled";
  expires_at: Date;
  created_at: Date;
}

export interface ReservationItemRow {
  reservation_id: string;
  product_id: string;
  quantity: number;
}

export async function findByOrderId(orderId: string): Promise<ReservationRow | undefined> {
  const rows = await query<ReservationRow>(
    "SELECT * FROM reservations WHERE order_id = $1",
    [orderId],
  );
  return rows[0];
}

export async function findById(id: string): Promise<ReservationRow | undefined> {
  const rows = await query<ReservationRow>("SELECT * FROM reservations WHERE id = $1", [id]);
  return rows[0];
}

export async function getItems(reservationId: string): Promise<ReservationItemRow[]> {
  return query<ReservationItemRow>(
    "SELECT * FROM reservation_items WHERE reservation_id = $1",
    [reservationId],
  );
}

export async function insertReservation(
  client: pg.PoolClient,
  orderId: string,
  expiresAt: Date,
): Promise<ReservationRow> {
  const { rows } = await client.query<ReservationRow>(
    "INSERT INTO reservations (order_id, expires_at) VALUES ($1, $2) RETURNING *",
    [orderId, expiresAt],
  );
  return rows[0]!;
}

export async function insertItem(
  client: pg.PoolClient,
  reservationId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  await client.query(
    "INSERT INTO reservation_items (reservation_id, product_id, quantity) VALUES ($1, $2, $3)",
    [reservationId, productId, quantity],
  );
}

export async function decrementStock(
  client: pg.PoolClient,
  productId: string,
  quantity: number,
): Promise<boolean> {
  const { rowCount } = await client.query(
    `UPDATE products
     SET stock = stock - $2, updated_at = now()
     WHERE id = $1 AND is_active AND stock >= $2`,
    [productId, quantity],
  );
  return rowCount === 1;
}

export async function restoreStock(
  client: pg.PoolClient,
  productId: string,
  quantity: number,
): Promise<void> {
  await client.query(
    "UPDATE products SET stock = stock + $2, updated_at = now() WHERE id = $1",
    [productId, quantity],
  );
}

export async function setStatus(
  client: pg.PoolClient,
  reservationId: string,
  status: "committed" | "cancelled",
): Promise<boolean> {
  const { rowCount } = await client.query(
    "UPDATE reservations SET status = $2, updated_at = now() WHERE id = $1 AND status = 'active'",
    [reservationId, status],
  );
  return rowCount === 1;
}

export async function lockExpired(client: pg.PoolClient, limit: number): Promise<ReservationRow[]> {
  const { rows } = await client.query<ReservationRow>(
    `SELECT * FROM reservations
     WHERE status = 'active' AND expires_at < now()
     ORDER BY expires_at
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,
    [limit],
  );
  return rows;
}