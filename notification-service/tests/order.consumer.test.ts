import { describe, expect, it } from "vitest";
import { handleOrderEvent } from "../src/consumers/order.consumer.js";
import { query } from "../src/db/pool.js";
import { makeMessage, orderPayload } from "./helpers.js";

interface NotificationRow {
  message_id: string;
  event_type: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
}

const selectAll = () =>
  query<NotificationRow>("SELECT * FROM notifications ORDER BY created_at, message_id");

describe("handleOrderEvent", () => {
  it("order.created створює рівно один запис із заповненими subject і body", async () => {
    const payload = orderPayload({ orderId: "ord-1", totalCents: 25_000, currency: "USD" });

    await handleOrderEvent(makeMessage("order.created", payload, "msg-created-1"));

    const rows = await selectAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].message_id).toBe("msg-created-1");
    expect(rows[0].event_type).toBe("order.created");
    expect(rows[0].subject).toBe("Замовлення прийнято");
    expect(rows[0].body).toContain("ord-1");
    expect(rows[0].body).toContain("250.00 USD");
    expect(rows[0].recipient).toBe(`user-${payload.userId.slice(0, 8)}@example.com`);
    expect(rows[0].status).toBe("sent");
  });

  it("повторна доставка з тим самим messageId не дублює запис і не кидає помилку", async () => {
    const msg = makeMessage("order.created", orderPayload(), "msg-duplicate");

    await handleOrderEvent(msg);
    await expect(handleOrderEvent(msg)).resolves.toBeUndefined();

    const rows = await selectAll();
    expect(rows).toHaveLength(1);
  });

  it("два різні messageId дають два записи", async () => {
    const payload = orderPayload();

    await handleOrderEvent(makeMessage("order.created", payload, "msg-a"));
    await handleOrderEvent(makeMessage("order.created", payload, "msg-b"));

    const rows = await selectAll();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.message_id).sort()).toEqual(["msg-a", "msg-b"]);
  });

  it("подія без messageId ігнорується без помилки і без запису", async () => {
    await expect(
      handleOrderEvent(makeMessage("order.created", orderPayload())),
    ).resolves.toBeUndefined();

    expect(await selectAll()).toHaveLength(0);
  });

  it("невідомий тип події не створює запису", async () => {
    await handleOrderEvent(makeMessage("order.shipped", orderPayload(), "msg-shipped"));

    expect(await selectAll()).toHaveLength(0);
  });

  it("order.paid створює запис із власним subject", async () => {
    await handleOrderEvent(
      makeMessage("order.paid", orderPayload({ orderId: "ord-paid" }), "msg-paid"),
    );

    const rows = await selectAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe("order.paid");
    expect(rows[0].subject).toBe("Оплату отримано");
    expect(rows[0].body).toContain("ord-paid");
  });

  it("order.cancelled створює запис із власним subject", async () => {
    await handleOrderEvent(
      makeMessage("order.cancelled", orderPayload({ orderId: "ord-cancel" }), "msg-cancel"),
    );

    const rows = await selectAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe("order.cancelled");
    expect(rows[0].subject).toBe("Замовлення скасовано");
    expect(rows[0].body).toContain("ord-cancel");
  });
});
