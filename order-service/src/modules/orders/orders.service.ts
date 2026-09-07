import crypto from "node:crypto";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { withTransaction } from "../../db/pool.js";
import * as cartClient from "../../clients/cart.client.js";
import * as productClient from "../../clients/products.client.js";
import * as repo from "./orders.repository.js";

export interface PublicOrder {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
  items: {
    productId: string;
    name: string;
    slug: string;
    unitPriceCents: number;
    quantity: number;
    subtotalCents: number;
  }[];
  createdAt: Date;
}

async function toPublic(row: repo.OrderRow): Promise<PublicOrder> {
  const items = await repo.getItems(row.id);
  return {
    id: row.id,
    status: row.status,
    totalCents: row.total_cents,
    currency: row.currency,
    items: items.map((i) => ({
      productId: i.product_id,
      name: i.product_name,
      slug: i.product_slug,
      unitPriceCents: i.unit_price_cents,
      quantity: i.quantity,
      subtotalCents: i.unit_price_cents * i.quantity,
    })),
    createdAt: row.created_at,
  };
}

export async function checkout(
  userId: string,
  authHeader: string,
  idempotencyKey: string,
): Promise<PublicOrder> {
  const existingId = await repo.findByIdempotencyKey(idempotencyKey, userId);
  if (existingId) {
    const existing = await repo.findById(existingId);
    if (existing) return toPublic(existing);
  }

  const cart = await cartClient.getCart(authHeader);
  if (cart.items.length === 0) throw badRequest("Кошик порожній");

  const orderId = crypto.randomUUID();

  const reservation = await productClient.createReservation(
    orderId,
    cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  );

  try {
    const order = await withTransaction(async (client) => {
      const row = await repo.insertOrder(client, {
        id: orderId,
        userId,
        totalCents: cart.totalCents,
        currency: cart.currency,
        reservationId: reservation.id,
      });

      await repo.insertItems(client, orderId, cart.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        slug: i.slug,
        priceCents: i.priceCents,
        quantity: i.quantity,
      })));

      await repo.insertIdempotencyKey(client, idempotencyKey, userId, orderId);

      await repo.insertOutboxEvent(client, "order.created", orderId, {
        orderId,
        userId,
        totalCents: cart.totalCents,
        currency: cart.currency,
        items: cart.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          priceCents: i.priceCents,
        })),
      });

      return row;
    });

    await productClient.commitReservation(reservation.id);
    await cartClient.clearCart(authHeader);

    return toPublic(order);
  } catch (err) {
    await productClient.cancelReservation(reservation.id);
    throw err;
  }
}

export async function markPaid(orderId: string): Promise<void> {
  const row = await repo.findById(orderId);
  if (!row) throw notFound("Замовлення не знайдено");
  if (row.status === "paid") return;
  if (row.status !== "pending") {
    throw conflict(`Не можна оплатити замовлення у статусі "${row.status}"`);
  }

  await withTransaction(async (client) => {
    // Умова в UPDATE — захист від гонки при паралельних вебхуках.
    const { rowCount } = await client.query(
      "UPDATE orders SET status='paid', updated_at=now() WHERE id=$1 AND status='pending'",
      [orderId],
    );
    if (rowCount !== 1) return;

    await repo.insertOutboxEvent(client, "order.paid", orderId, {
      orderId,
      userId: row.user_id,
      totalCents: row.total_cents,
      currency: row.currency,
    });
  });
}

export async function cancel(userId: string, orderId: string): Promise<PublicOrder> {
  const row = await repo.findById(orderId);
  if (!row) throw notFound("Замовлення не знайдено");
  if (row.user_id !== userId) throw notFound("Замовлення не знайдено");
  if (row.status === "cancelled") return toPublic(row);
  if (row.status !== "pending") {
    throw conflict(`Не можна скасувати замовлення у статусі "${row.status}"`);
  }

  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      "UPDATE orders SET status='cancelled', updated_at=now() WHERE id=$1 AND status='pending'",
      [orderId],
    );
    if (rowCount !== 1) return;

    await repo.insertOutboxEvent(client, "order.cancelled", orderId, {
      orderId,
      userId: row.user_id,
      reservationId: row.reservation_id,
      totalCents: row.total_cents,
    });
  });

  const updated = await repo.findById(orderId);
  return toPublic(updated!);
}

export async function getById(userId: string, orderId: string): Promise<PublicOrder> {
  const row = await repo.findById(orderId);
  if (!row) throw notFound("Замовлення не знайдено");
  if (row.user_id !== userId) throw notFound("Замовлення не знайдено");
  return toPublic(row);
}

export async function list(userId: string, page: number, limit: number): Promise<PublicOrder[]> {
  const rows = await repo.findByUser(userId, limit, (page - 1) * limit);
  return Promise.all(rows.map(toPublic));
}