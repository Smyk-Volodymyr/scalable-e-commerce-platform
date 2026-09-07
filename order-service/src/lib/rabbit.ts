import amqp from "amqplib";
import { env } from "../config/env.js";

export const EXCHANGE = "shop.events";

let connection: amqp.ChannelModel | null = null;
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

export async function closeRabbit(): Promise<void> {
  await channel?.close();
  await connection?.close();
}