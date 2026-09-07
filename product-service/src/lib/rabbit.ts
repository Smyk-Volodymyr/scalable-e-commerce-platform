import amqp from "amqplib";
import type { ConsumeMessage } from "amqplib";
import { env } from "../config/env.js";

export const EXCHANGE = "shop.events";

let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
let channel: amqp.Channel | null = null;

export async function connectRabbit(): Promise<void> {
  connection = await amqp.connect(env.RABBITMQ_URL);
  channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE, "topic", { durable: true });

  connection.on("error", (err) => console.error("Помилка RabbitMQ:", err));
  connection.on("close", () => console.warn("Зʼєднання з RabbitMQ закрито"));
}

export function getChannel(): amqp.Channel {
  if (!channel) throw new Error("RabbitMQ не підключено");
  return channel;
}

export async function consume(
  queue: string,
  patterns: string[],
  handler: (msg: ConsumeMessage) => Promise<void>,
): Promise<void> {
  const ch = getChannel();

  // durable: черга переживе перезапуск брокера, і повідомлення
  // накопичуватимуться, поки споживач лежить.
  await ch.assertQueue(queue, { durable: true });

  for (const pattern of patterns) {
    await ch.bindQueue(queue, EXCHANGE, pattern);
  }

  // Брокер не віддасть більше 10 непідтверджених повідомлень одночасно.
  // Без цього він вивалить усю чергу в памʼять одного споживача.
  await ch.prefetch(10);

  await ch.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      await handler(msg);
      // ack — підтвердження обробки. Поки його немає, повідомлення
      // числиться за нами і повернеться в чергу, якщо процес впаде.
      ch.ack(msg);
    } catch (err) {
      console.error("Помилка обробки повідомлення:", err);
      // requeue: false — інакше отруєне повідомлення крутитиметься
      // по колу нескінченно. У проді сюди чіпляють dead letter queue.
      ch.nack(msg, false, false);
    }
  });
}

export async function closeRabbit(): Promise<void> {
  await channel?.close();
  await connection?.close();
}