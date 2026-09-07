import { env } from "../config/env.js";
import { AppError } from "@shop/shared/errors";

export interface Order {
  id: string;
  status: string;
  totalCents: number;
  currency: string;
}

export async function getOrder(orderId: string, authHeader: string): Promise<Order> {
  let res: Response;
  try {
    res = await fetch(`${env.ORDER_SERVICE_URL}/orders/${orderId}`, {
      signal: AbortSignal.timeout(3000),
      headers: { authorization: authHeader, accept: "application/json" },
    });
  } catch {
    throw new AppError(503, "Сервіс замовлень недоступний");
  }
  if (res.status === 404) throw new AppError(404, "Замовлення не знайдено");
  if (!res.ok) throw new AppError(502, "Сервіс замовлень повернув помилку");
  return (await res.json()) as Order;
}

export async function markPaid(orderId: string): Promise<void> {
  const res = await fetch(`${env.ORDER_SERVICE_URL}/internal/orders/${orderId}/paid`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new AppError(502, "Не вдалося оновити статус замовлення");
}