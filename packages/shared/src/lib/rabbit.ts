import amqp from "amqplib";
import type { ConsumeMessage } from "amqplib";

export const EXCHANGE = "shop.events";

export interface Rabbit {
  connectRabbit(): Promise<void>;
  getChannel(): amqp.Channel;
  consume(
    queue: string,
    patterns: string[],
    handler: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void>;
  closeRabbit(): Promise<void>;
}

// Фабрика з тієї ж причини, що й у createPool: URL брокера живе у схемі оточення
// сервісу. З'єднання і канал тримаються в замиканні, а не в модульних змінних —
// так два виклики createRabbit не заважали б один одному.
export function createRabbit(url: string): Rabbit {
  let connection: amqp.ChannelModel | null = null;
  let channel: amqp.Channel | null = null;

  async function connectRabbit(): Promise<void> {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE, "topic", { durable: true });

    connection.on("error", (err) => console.error("Помилка RabbitMQ:", err));
    connection.on("close", () => console.warn("Зʼєднання з RabbitMQ закрито"));
  }

  function getChannel(): amqp.Channel {
    if (!channel) throw new Error("RabbitMQ не підключено");
    return channel;
  }

  async function consume(
    queue: string,
    patterns: string[],
    handler: (msg: ConsumeMessage) => Promise<void>,
  ): Promise<void> {
    const ch = getChannel();

    await ch.assertQueue(queue, { durable: true });

    for (const pattern of patterns) {
      await ch.bindQueue(queue, EXCHANGE, pattern);
    }

    await ch.prefetch(10);

    await ch.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        await handler(msg);
        ch.ack(msg);
      } catch (err) {
        console.error("Помилка обробки повідомлення:", err);
        ch.nack(msg, false, false);
      }
    });
  }

  async function closeRabbit(): Promise<void> {
    await channel?.close();
    await connection?.close();
  }

  return { connectRabbit, getChannel, consume, closeRabbit };
}
