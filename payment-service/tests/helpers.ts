import jwt from "jsonwebtoken";
import { pool } from "../src/db/pool.js";
import { TEST_ENV } from "./test-env.js";

export interface TokenPayload {
  sub: string;
  email: string;
  role?: "customer" | "admin";
}

// Ходити в user-service за токеном не потрібно й не можна: сервіси перевіряють
// підпис локально тим самим секретом.
export function signToken({ sub, email, role = "customer" }: TokenPayload): string {
  return jwt.sign({ sub, email, role }, TEST_ENV.JWT_SECRET!, {
    issuer: "user-service",
    expiresIn: "1h",
  });
}

export interface SeededPayment {
  id: string;
  order_id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  provider_intent_id: string | null;
  last_error: string | null;
}

// Сідуємо напряму SQL-ом, а не через POST /payments/intent: створення платежу
// ходить у Stripe і в order-service, а тестуємо ми тут вебхук.
export async function seedPayment(d: {
  orderId: string;
  userId: string;
  intentId: string;
  amountCents?: number;
  currency?: string;
  status?: string;
}): Promise<SeededPayment> {
  const { rows } = await pool.query<SeededPayment>(
    `INSERT INTO payments (order_id, user_id, amount_cents, currency, status, provider_intent_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      d.orderId,
      d.userId,
      d.amountCents ?? 12_500,
      d.currency ?? "UAH",
      d.status ?? "pending",
      d.intentId,
    ],
  );
  return rows[0]!;
}

export async function getPaymentByIntentId(intentId: string): Promise<SeededPayment | undefined> {
  const { rows } = await pool.query<SeededPayment>(
    "SELECT * FROM payments WHERE provider_intent_id = $1",
    [intentId],
  );
  return rows[0];
}

export async function listProcessedEvents(): Promise<{ event_id: string; event_type: string }[]> {
  const { rows } = await pool.query<{ event_id: string; event_type: string }>(
    "SELECT event_id, event_type FROM processed_events ORDER BY processed_at",
  );
  return rows;
}

// Мінімальна форма події Stripe, якої достатньо для service.handleEvent.
// Реальний конверт не потрібен: constructEvent у тестах замоканий і просто
// повертає цей об'єкт.
export function stripeEvent(d: {
  id: string;
  type: string;
  intentId: string;
  orderId?: string;
  userId?: string;
  lastError?: string;
}): Record<string, unknown> {
  return {
    id: d.id,
    type: d.type,
    api_version: "2026-08-26.dahlia",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: d.intentId,
        object: "payment_intent",
        metadata: {
          ...(d.orderId ? { orderId: d.orderId } : {}),
          ...(d.userId ? { userId: d.userId } : {}),
        },
        ...(d.lastError ? { last_payment_error: { message: d.lastError } } : {}),
      },
    },
  };
}
