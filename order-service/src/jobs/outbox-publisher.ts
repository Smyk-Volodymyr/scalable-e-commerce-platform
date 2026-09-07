import { withTransaction } from "../db/pool.js";
import { EXCHANGE, getChannel } from "../lib/rabbit.js";
import * as repo from "../modules/orders/orders.repository.js";

async function publishBatch(): Promise<number> {
  return withTransaction(async (client) => {
    const events = await repo.lockPendingEvents(client, 50);
    const channel = getChannel();

    for (const event of events) {
      try {
        channel.publish(
          EXCHANGE,
          event.event_type,
          Buffer.from(JSON.stringify(event.payload)),
          {
            persistent: true,
            messageId: event.id,
            contentType: "application/json",
          },
        );
        await repo.markPublished(client, event.id);
      } catch (err) {
        await repo.markFailed(client, event.id, String(err));
      }
    }

    return events.length;
  });
}

export function startOutboxPublisher(): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      const count = await publishBatch();
      if (count > 0) console.log(`Опубліковано подій: ${count}`);
    } catch (err) {
      console.error("Помилка публікації outbox:", err);
    }
  }, 2000);

  timer.unref();
  return timer;
}