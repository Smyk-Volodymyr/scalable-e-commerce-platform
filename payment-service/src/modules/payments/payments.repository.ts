import type pg from "pg";
import { query } from "../../db/pool.js";

export interface PaymentRow {
  id: string;
  order_id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  provider_intent_id: string | null;
  last_error: string | null;
  created_at: Date;
}

export async function findByOrderId(orderId: string): Promise<PaymentRow | undefined> {
  const rows = await query<PaymentRow>("SELECT * FROM payments WHERE order_id = $1", [orderId]);
  return rows[0];
}

export async function findByIntentId(intentId: string): Promise<PaymentRow | undefined> {
  const rows = await query<PaymentRow>(
    "SELECT * FROM payments WHERE provider_intent_id = $1",
    [intentId],
  );
  return rows[0];
}

export async function insert(d: {
  orderId: string; userId: string; amountCents: number; currency: string; intentId: string;
}): Promise<PaymentRow> {
  const rows = await query<PaymentRow>(
    `INSERT INTO payments (order_id, user_id, amount_cents, currency, provider_intent_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [d.orderId, d.userId, d.amountCents, d.currency, d.intentId],
  );
  return rows[0]!;
}

export async function setStatus(
  intentId: string,
  status: string,
  lastError?: string,
): Promise<boolean> {
  // AND status = 'pending' — захист від зміни вже фінального статусу.
  // Події від Stripe можуть прийти не по порядку.
  const rows = await query<{ id: string }>(
    `UPDATE payments SET status = $2, last_error = $3, updated_at = now()
     WHERE provider_intent_id = $1 AND status = 'pending' RETURNING id`,
    [intentId, status, lastError ?? null],
  );
  return rows.length > 0;
}

// Повертає false, якщо подію вже обробляли. ON CONFLICT DO NOTHING
// робить перевірку атомарною — два паралельні вебхуки не пройдуть обидва.
export async function markEventProcessed(
  client: pg.PoolClient,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const { rowCount } = await client.query(
    `INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType],
  );
  return rowCount === 1;
}