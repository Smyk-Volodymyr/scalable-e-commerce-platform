import type { ConsumeMessage } from "amqplib";

export interface OrderEventPayload {
  orderId: string;
  userId: string;
  totalCents: number;
  currency: string;
}

export function orderPayload(over: Partial<OrderEventPayload> = {}): OrderEventPayload {
  return {
    orderId: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    totalCents: 12_345,
    currency: "UAH",
    ...over,
  };
}

// RabbitMQ у тестах не піднімаємо: handleOrderEvent читає з msg лише routingKey,
// messageId і content, тож достатньо зібрати ці три поля вручну.
export function makeMessage(
  routingKey: string,
  payload: unknown,
  messageId?: string,
): ConsumeMessage {
  return {
    fields: { routingKey },
    properties: messageId === undefined ? {} : { messageId },
    content: Buffer.from(JSON.stringify(payload)),
  } as unknown as ConsumeMessage;
}
