import { randomUUID } from "node:crypto";
import request from "supertest";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

// vi.mock піднімається над імпортами, тому виклики стоять до import-ів застосунку.
// Stripe SDK мокаємо, щоб керувати constructEvent: без справжнього підпису
// перевірити ані успішний шлях, ані зіпсований підпис неможливо.
vi.mock("../src/lib/stripe.js", () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
  },
}));

// Клієнт order-service мокаємо, щоб markPaid не ходив по мережі і щоб мати
// лічильник викликів — саме на ньому тримається перевірка ідемпотентності.
vi.mock("../src/clients/orders.client.js", () => ({
  getOrder: vi.fn(),
  markPaid: vi.fn(async () => {}),
}));

import { app } from "../src/app.js";
import * as ordersClient from "../src/clients/orders.client.js";
import { stripe } from "../src/lib/stripe.js";
import {
  getPaymentByIntentId,
  listProcessedEvents,
  seedPayment,
  stripeEvent,
} from "./helpers.js";

const constructEvent = vi.mocked(stripe.webhooks.constructEvent);
const markPaid = vi.mocked(ordersClient.markPaid);

// Тіло йде сирим Buffer-ом із content-type: application/json — роут навішений
// на express.raw({ type: "application/json" }), а не на json-парсер.
// serialize() тут обов'язковий: інакше superagent, побачивши json content-type,
// прогонить Buffer через JSON.stringify і на сервер приїде {"type":"Buffer",
// "data":[...]} замість самої події — тест би "проходив" на неправильному тілі.
function postWebhook(payload: unknown, signature: string | null = "t=1,v1=fake_signature") {
  const req = request(app)
    .post("/payments/webhook")
    .set("content-type", "application/json")
    .serialize((body: unknown) => body as string);
  if (signature !== null) req.set("stripe-signature", signature);
  return req.send(Buffer.from(JSON.stringify(payload), "utf8"));
}

describe("POST /payments/webhook", () => {
  it("повертає 400 без заголовка stripe-signature", async () => {
    const res = await postWebhook({ id: "evt_no_signature" }, null);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Відсутній підпис" });
    expect(constructEvent).not.toHaveBeenCalled();
    expect(await listProcessedEvents()).toHaveLength(0);
  });

  it("повертає 400 і нічого не пише в БД, якщо підпис не сходиться", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });

    const res = await postWebhook(
      stripeEvent({
        id: "evt_bad_signature",
        type: "payment_intent.succeeded",
        intentId: "pi_test_bad_signature",
      }),
    );

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Некоректний підпис" });
    expect(await listProcessedEvents()).toHaveLength(0);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("на payment_intent.succeeded переводить платіж у succeeded і кличе markPaid", async () => {
    const orderId = randomUUID();
    const userId = randomUUID();
    const intentId = "pi_test_succeeded";
    await seedPayment({ orderId, userId, intentId });

    const event = stripeEvent({
      id: "evt_succeeded_1",
      type: "payment_intent.succeeded",
      intentId,
      orderId,
      userId,
    });
    constructEvent.mockReturnValue(event as unknown as Stripe.Event);

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    // Пряма перевірка порядку middleware: у constructEvent мають прилетіти сирі
    // байти. Якби express.json() стояв перед вебхуком, тут був би об'єкт і
    // перевірка підпису падала б на кожній події.
    const [rawBody, signature, secret] = constructEvent.mock.calls[0]!;
    expect(Buffer.isBuffer(rawBody)).toBe(true);
    expect(JSON.parse(String(rawBody)).id).toBe("evt_succeeded_1");
    expect(signature).toBe("t=1,v1=fake_signature");
    expect(secret).toBe(process.env.STRIPE_WEBHOOK_SECRET);

    const payment = await getPaymentByIntentId(intentId);
    expect(payment?.status).toBe("succeeded");
    expect(payment?.last_error).toBeNull();

    expect(markPaid).toHaveBeenCalledTimes(1);
    expect(markPaid).toHaveBeenCalledWith(orderId);

    expect(await listProcessedEvents()).toEqual([
      { event_id: "evt_succeeded_1", event_type: "payment_intent.succeeded" },
    ]);
  });

  it("ідемпотентний: повторна подія з тим самим id не дублює жодного ефекту", async () => {
    const orderId = randomUUID();
    const userId = randomUUID();
    const intentId = "pi_test_idempotent";
    await seedPayment({ orderId, userId, intentId });

    const event = stripeEvent({
      id: "evt_idempotent_1",
      type: "payment_intent.succeeded",
      intentId,
      orderId,
      userId,
    });
    constructEvent.mockReturnValue(event as unknown as Stripe.Event);

    const first = await postWebhook(event);
    expect(first.status).toBe(200);

    const afterFirst = await getPaymentByIntentId(intentId);
    expect(afterFirst?.status).toBe("succeeded");

    // Stripe ретраїть доставку, поки не отримає 2xx, тож дубль події —
    // штатна ситуація, а не аномалія.
    const second = await postWebhook(event);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ received: true });

    expect(await listProcessedEvents()).toEqual([
      { event_id: "evt_idempotent_1", event_type: "payment_intent.succeeded" },
    ]);
    expect(markPaid).toHaveBeenCalledTimes(1);

    const afterSecond = await getPaymentByIntentId(intentId);
    expect(afterSecond?.status).toBe("succeeded");
    expect(afterSecond?.last_error).toBeNull();
    // Друга обробка не мала торкатись рядка взагалі.
    expect(afterSecond?.id).toBe(afterFirst?.id);
  });

  it("на payment_intent.payment_failed ставить failed і зберігає last_error", async () => {
    const orderId = randomUUID();
    const userId = randomUUID();
    const intentId = "pi_test_failed";
    await seedPayment({ orderId, userId, intentId });

    const event = stripeEvent({
      id: "evt_failed_1",
      type: "payment_intent.payment_failed",
      intentId,
      orderId,
      userId,
      lastError: "Your card was declined.",
    });
    constructEvent.mockReturnValue(event as unknown as Stripe.Event);

    const res = await postWebhook(event);

    expect(res.status).toBe(200);

    const payment = await getPaymentByIntentId(intentId);
    expect(payment?.status).toBe("failed");
    expect(payment?.last_error).toBe("Your card was declined.");

    expect(markPaid).not.toHaveBeenCalled();
  });

  it("подію невідомого типу приймає, фіксує в processed_events і нічого не змінює", async () => {
    const orderId = randomUUID();
    const intentId = "pi_test_ignored";
    await seedPayment({ orderId, userId: randomUUID(), intentId });

    const event = stripeEvent({
      id: "evt_ignored_1",
      type: "payment_intent.created",
      intentId,
      orderId,
    });
    constructEvent.mockReturnValue(event as unknown as Stripe.Event);

    const res = await postWebhook(event);

    expect(res.status).toBe(200);
    expect((await getPaymentByIntentId(intentId))?.status).toBe("pending");
    expect(markPaid).not.toHaveBeenCalled();
    expect(await listProcessedEvents()).toEqual([
      { event_id: "evt_ignored_1", event_type: "payment_intent.created" },
    ]);
  });
});
