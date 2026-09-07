import crypto from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/clients/cart.client.js", () => ({
  getCart: vi.fn(),
  clearCart: vi.fn(),
}));
vi.mock("../src/clients/products.client.js", () => ({
  createReservation: vi.fn(),
  commitReservation: vi.fn(),
  cancelReservation: vi.fn(),
  releaseCommitted: vi.fn(),
}));

import { app } from "../src/app.js";
import { query } from "../src/db/pool.js";
import * as cartClient from "../src/clients/cart.client.js";
import * as productClient from "../src/clients/products.client.js";
import { makeCart, makeReservation, makeUser, readOutbox, type TestUser } from "./helpers.js";

const getCart = vi.mocked(cartClient.getCart);
const clearCart = vi.mocked(cartClient.clearCart);
const createReservation = vi.mocked(productClient.createReservation);
const commitReservation = vi.mocked(productClient.commitReservation);

describe("POST /orders/:id/cancel", () => {
  let owner: TestUser;
  let reservationId: string;

  beforeEach(() => {
    owner = makeUser();
    getCart.mockResolvedValue(makeCart());
    clearCart.mockResolvedValue(undefined);
    createReservation.mockImplementation(async (orderId) => {
      const reservation = makeReservation(orderId);
      reservationId = reservation.id;
      return reservation;
    });
    commitReservation.mockResolvedValue(undefined);
  });

  async function createOrder(user: TestUser): Promise<string> {
    const res = await request(app)
      .post("/orders/checkout")
      .set("authorization", user.auth)
      .set("idempotency-key", crypto.randomUUID());
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  it("переводить замовлення у статус cancelled", async () => {
    const orderId = await createOrder(owner);

    const res = await request(app).post(`/orders/${orderId}/cancel`).set("authorization", owner.auth);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(res.body.status).toBe("cancelled");

    const rows = await query<{ status: string }>("SELECT status FROM orders WHERE id = $1", [orderId]);
    expect(rows[0]!.status).toBe("cancelled");
  });

  it("пише в outbox подію order.cancelled з reservationId у payload", async () => {
    const orderId = await createOrder(owner);

    await request(app).post(`/orders/${orderId}/cancel`).set("authorization", owner.auth).expect(200);

    const events = await readOutbox(orderId, "order.cancelled");
    expect(events).toHaveLength(1);
    expect(events[0]!.aggregate_id).toBe(orderId);
    // Резерв уже закомічений, тому повернути залишок зможе лише споживач події —
    // без reservationId у payload склад залишиться списаним назавжди.
    expect(events[0]!.payload).toMatchObject({ orderId, userId: owner.id, reservationId });
  });

  it("повторне скасування не створює другий рядок в outbox", async () => {
    const orderId = await createOrder(owner);

    await request(app).post(`/orders/${orderId}/cancel`).set("authorization", owner.auth).expect(200);
    const second = await request(app)
      .post(`/orders/${orderId}/cancel`)
      .set("authorization", owner.auth);

    expect(second.status).toBe(200);
    expect(second.body.status).toBe("cancelled");
    expect(await readOutbox(orderId, "order.cancelled")).toHaveLength(1);
  });

  it("на чуже замовлення повертає 404 і не змінює його статус", async () => {
    const orderId = await createOrder(owner);
    const stranger = makeUser();

    const res = await request(app)
      .post(`/orders/${orderId}/cancel`)
      .set("authorization", stranger.auth);

    expect(res.status).toBe(404);
    const rows = await query<{ status: string }>("SELECT status FROM orders WHERE id = $1", [orderId]);
    expect(rows[0]!.status).toBe("pending");
    expect(await readOutbox(orderId, "order.cancelled")).toHaveLength(0);
  });
});
