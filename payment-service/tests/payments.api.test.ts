import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// Stripe і клієнт order-service мокаємо навіть тут: імпорт застосунку тягне
// src/lib/stripe.ts, а справжній SDK у тестах не потрібен.
vi.mock("../src/lib/stripe.js", () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
  },
}));

vi.mock("../src/clients/orders.client.js", () => ({
  getOrder: vi.fn(),
  markPaid: vi.fn(async () => {}),
}));

import { app } from "../src/app.js";
import { seedPayment, signToken } from "./helpers.js";

describe("службові роути", () => {
  it("GET /health відповідає ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "payment-service" });
  });

  it("GET /health/db ходить у справжню БД", async () => {
    const res = await request(app).get("/health/db");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(Number.isNaN(Date.parse(res.body.dbTime))).toBe(false);
  });

  it("невідомий роут віддає 404 від notFoundHandler", async () => {
    const res = await request(app).get("/no-such-route");

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("/no-such-route");
  });
});

describe("GET /payments/order/:orderId", () => {
  it("без токена — 401", async () => {
    const res = await request(app).get(`/payments/order/${randomUUID()}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Відсутній токен авторизації");
  });

  it("з підробленим підписом токена — 401", async () => {
    const res = await request(app)
      .get(`/payments/order/${randomUUID()}`)
      .set("authorization", "Bearer not.a.real.token");

    expect(res.status).toBe(401);
  });

  it("некоректний UUID — 400", async () => {
    const token = signToken({ sub: randomUUID(), email: "buyer@example.com" });

    const res = await request(app)
      .get("/payments/order/not-a-uuid")
      .set("authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Некоректний ідентифікатор");
  });

  it("повертає платіж власника", async () => {
    const userId = randomUUID();
    const orderId = randomUUID();
    const payment = await seedPayment({
      orderId,
      userId,
      intentId: "pi_test_get_by_order",
      amountCents: 4200,
    });

    const res = await request(app)
      .get(`/payments/order/${orderId}`)
      .set("authorization", `Bearer ${signToken({ sub: userId, email: "buyer@example.com" })}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: payment.id,
      orderId,
      amountCents: 4200,
      currency: "UAH",
      status: "pending",
    });
  });

  it("чужий платіж не віддає — 404, а не 403 (не розкриваємо факт існування)", async () => {
    const orderId = randomUUID();
    await seedPayment({ orderId, userId: randomUUID(), intentId: "pi_test_foreign" });

    const res = await request(app)
      .get(`/payments/order/${orderId}`)
      .set("authorization", `Bearer ${signToken({ sub: randomUUID(), email: "other@example.com" })}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Платіж не знайдено");
  });
});

describe("POST /payments/intent", () => {
  it("без токена — 401", async () => {
    const res = await request(app).post("/payments/intent").send({ orderId: randomUUID() });

    expect(res.status).toBe(401);
  });

  it("некоректне тіло — 400 з деталями по полю", async () => {
    const token = signToken({ sub: randomUUID(), email: "buyer@example.com" });

    const res = await request(app)
      .post("/payments/intent")
      .set("authorization", `Bearer ${token}`)
      .send({ orderId: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Некоректні дані");
    expect(res.body.details).toHaveProperty("orderId");
  });
});
