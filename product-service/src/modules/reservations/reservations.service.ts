import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { env } from "../../config/env.js";
import { withTransaction } from "../../db/pool.js";
import * as repo from "./reservations.repository.js";
import type { CreateReservationInput } from "./reservations.schemas.js";

export interface PublicReservation {
  id: string;
  orderId: string;
  status: string;
  expiresAt: Date;
}

function toPublic(row: repo.ReservationRow): PublicReservation {
  return { id: row.id, orderId: row.order_id, status: row.status, expiresAt: row.expires_at };
}

export async function create(input: CreateReservationInput): Promise<PublicReservation> {
  const existing = await repo.findByOrderId(input.orderId);
  if (existing) return toPublic(existing);

  const expiresAt = new Date(Date.now() + env.RESERVATION_TTL_MINUTES * 60 * 1000);

  const items = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId));

  return withTransaction(async (client) => {
    const reservation = await repo.insertReservation(client, input.orderId, expiresAt);

    for (const item of items) {
      const ok = await repo.decrementStock(client, item.productId, item.quantity);
      if (!ok) {
        throw conflict(`Недостатньо товару ${item.productId}`);
      }
      await repo.insertItem(client, reservation.id, item.productId, item.quantity);
    }

    return toPublic(reservation);
  });
}

export async function commit(reservationId: string): Promise<void> {
  const reservation = await repo.findById(reservationId);
  if (!reservation) throw notFound("Резерв не знайдено");

  if (reservation.status === "committed") return;
  if (reservation.status === "cancelled") throw badRequest("Резерв уже скасовано");
  if (reservation.expires_at.getTime() < Date.now()) throw badRequest("Термін резерву вичерпано");

  await withTransaction(async (client) => {
    await repo.setStatus(client, reservationId, "committed");
  });
}

export async function cancel(reservationId: string): Promise<void> {
  const reservation = await repo.findById(reservationId);
  if (!reservation) throw notFound("Резерв не знайдено");
  if (reservation.status === "cancelled") return; 
  if (reservation.status === "committed") throw badRequest("Резерв уже підтверджено");

  const items = await repo.getItems(reservationId);

  await withTransaction(async (client) => {
    const changed = await repo.setStatus(client, reservationId, "cancelled");
    if (!changed) return;

    for (const item of items) {
      await repo.restoreStock(client, item.product_id, item.quantity);
    }
  });
}