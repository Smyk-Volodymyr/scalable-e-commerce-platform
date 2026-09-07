import type { ConsumeMessage } from "amqplib";
import { query } from "../db/pool.js";
import { consume } from "../lib/rabbit.js";

interface OrderEvent {
  orderId: string;
  userId: string;
  totalCents: number;
  currency: string;
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  console.log(`📧 ${to} | ${subject}\n   ${body}`);
}

function buildMessage(eventType: string, data: OrderEvent) {
  const amount = (data.totalCents / 100).toFixed(2);
  switch (eventType) {
    case "order.created":
      return {
        subject: "Замовлення прийнято",
        body: `Ваше замовлення ${data.orderId} на суму ${amount} ${data.currency} прийнято та очікує оплати.`,
      };
    case "order.paid":
      return {
        subject: "Оплату отримано",
        body: `Дякуємо! Замовлення ${data.orderId} оплачено на суму ${amount} ${data.currency}.`,
      };
    case "order.cancelled":
      return {
        subject: "Замовлення скасовано",
        body: `Замовлення ${data.orderId} скасовано.`,
      };
    default:
      return null;
  }
}

async function handle(msg: ConsumeMessage): Promise<void> {
  const eventType = msg.fields.routingKey;
  const messageId = msg.properties.messageId as string | undefined;
  const data = JSON.parse(msg.content.toString()) as OrderEvent;

  if (!messageId) {
    console.warn("Повідомлення без messageId, пропускаю");
    return;
  }

  const content = buildMessage(eventType, data);
  if (!content) {
    console.log(`Подія ${eventType} не потребує сповіщення`);
    return;
  }

  const recipient = `user-${data.userId.slice(0, 8)}@example.com`;

  await sendEmail(recipient, content.subject, content.body);

  await query(
    `INSERT INTO notifications (message_id, event_type, recipient, subject, body)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId, eventType, recipient, content.subject, content.body],
  );
}

export async function startOrderConsumer(): Promise<void> {
  await consume("notifications.orders", ["order.*"], handle);
  console.log("Споживач подій замовлень запущено");
}