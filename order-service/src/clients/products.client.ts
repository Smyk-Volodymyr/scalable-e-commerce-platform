import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

export interface Reservation {
  id: string;
  orderId: string;
  status: string;
  expiresAt: string;
}

export async function createReservation(
  orderId: string,
  items: { productId: string; quantity: number }[],
): Promise<Reservation> {
  let res: Response;
  try {
    res = await fetch(`${env.PRODUCT_SERVICE_URL}/internal/reservations`, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, items }),
    });
  } catch {
    throw new AppError(503, "Каталог недоступний");
  }

  if (res.status === 409) {
    const body = (await res.json()) as { error?: string };
    throw new AppError(409, body.error ?? "Товару недостатньо");
  }
  if (!res.ok) throw new AppError(502, "Каталог повернув помилку");

  return (await res.json()) as Reservation;
}

export async function commitReservation(reservationId: string): Promise<void> {
  const res = await fetch(`${env.PRODUCT_SERVICE_URL}/internal/reservations/${reservationId}/commit`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new AppError(502, "Не вдалося підтвердити резерв");
}

export async function cancelReservation(reservationId: string): Promise<void> {
  try {
    await fetch(`${env.PRODUCT_SERVICE_URL}/internal/reservations/${reservationId}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("Не вдалося скасувати резерв, спрацює TTL:", err);
  }
}