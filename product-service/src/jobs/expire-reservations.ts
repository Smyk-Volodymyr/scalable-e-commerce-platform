import { withTransaction } from "../db/pool.js";
import * as repo from "../modules/reservations/reservations.repository.js";

async function runOnce(): Promise<number> {
  return withTransaction(async (client) => {
    const expired = await repo.lockExpired(client, 100);

    for (const reservation of expired) {
      const items = await repo.getItems(reservation.id);
      await repo.setStatus(client, reservation.id, "cancelled");
      for (const item of items) {
        await repo.restoreStock(client, item.product_id, item.quantity);
      }
    }

    return expired.length;
  });
}

export function startExpiryJob(): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      const count = await runOnce();
      if (count > 0) console.log(`Звільнено протермінованих резервів: ${count}`);
    } catch (err) {
      console.error("Помилка звільнення резервів:", err);
    }
  }, 30_000);

  timer.unref();
  return timer;
}