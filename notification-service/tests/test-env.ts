// Один-єдиний источник правди про оточення тестів: його читає і vitest.config.ts,
// і globalSetup, який виконується поза контекстом test.env.
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  // Не "0": zod-схема сервісу вимагає positive(). У тестах listen не викликається
  // (supertest піднімає ефемерний порт сам), тож значення ні на що не впливає.
  PORT: "3006",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgres://shop:shop@localhost:5437/notification_service_test",
  // Змінна обовʼязкова за zod-схемою env.ts, хоча в тестах до брокера ми не ходимо:
  // handleOrderEvent викликається напряму, а connectRabbit — ніколи.
  RABBITMQ_URL: process.env.RABBITMQ_URL ?? "amqp://shop:shop@localhost:5672",
};
