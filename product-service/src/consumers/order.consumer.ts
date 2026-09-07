import type { ConsumeMessage } from "amqplib";
import { withTransaction } from "../db/pool.js";
import { consume } from "../lib/rabbit.js";
import * as reservations from "../modules/reservations/reservations.service.js";

interface OrderCancelledEvent {
  orderId: string;
  reservationId: string | null;
}

async function handle(msg: ConsumeMessage): Promise<void> {
  const eventType = msg.fields.routingKey;
  const messageId = msg.properties.messageId as string | undefined;

  if (eventType !== "order.cancelled") return;
  if (!messageId) return;

  const isNew = await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `INSERT INTO processed_events (message_id, event_type) VALUES ($1, $2)
       ON CONFLICT (message_id) DO NOTHING`,
      [messageId, eventType],
    );
    return rowCount === 1;
  });

  if (!isNew) {
    console.log(`Подію ${messageId} вже оброблено`);
    return;
  }

  const data = JSON.parse(msg.content.toString()) as OrderCancelledEvent;
  if (!data.reservationId) return;

  try {
    await reservations.release(data.reservationId);
    console.log(`Залишок повернуто за резервом ${data.reservationId}`);
  } catch (err) {
    console.warn(`Не вдалося повернути резерв ${data.reservationId}:`, err);
  }
}

export async function startOrderConsumer(): Promise<void> {
  await consume("products.orders", ["order.cancelled"], handle);
  console.log("Споживач подій замовлень запущено");
}