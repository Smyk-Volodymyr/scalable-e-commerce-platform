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
import * as cartClient from "../src/clients/cart.client.js";
import * as productClient from "../src/clients/products.client.js";
import { makeCart, makeReservation, makeUser, type TestUser } from "./helpers.js";

const getCart = vi.mocked(cartClient.getCart);
const clearCart = vi.mocked(cartClient.clearCart);
const createReservation = vi.mocked(productClient.createReservation);
const commitReservation = vi.mocked(productClient.commitReservation);

async function createOrder(user: TestUser): Promise<{ id: string; totalCents: number }> {
  const res = await request(app)
    .post("/orders/checkout")
    .set("authorization", user.auth)
    .set("idempotency-key", crypto.randomUUID());
  expect(res.status).toBe(201);
  return res.body;
}

describe("GET /orders/:id", () => {
  let owner: TestUser;

  beforeEach(() => {
    owner = makeUser();
    getCart.mockResolvedValue(makeCart());
    clearCart.mockResolvedValue(undefined);
    createReservation.mockImplementation(async (orderId) => makeReservation(orderId));
    commitReservation.mockResolvedValue(undefined);
  });

  it("повертає власне замовлення", async () => {
    const created = await createOrder(owner);

    const res = await request(app).get(`/orders/${created.id}`).set("authorization", owner.auth);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.totalCents).toBe(created.totalCents);
    expect(res.body.items).toHaveLength(1);
  });

  it("на чуже замовлення повертає 404, а не 403", async () => {
    const created = await createOrder(owner);
    const stranger = makeUser();

    const res = await request(app).get(`/orders/${created.id}`).set("authorization", stranger.auth);

    // Саме 404: 403 підтвердив би, що замовлення з таким id існує, і дав би змогу
    // перебором зібрати чужі ідентифікатори. 404 не розкриває нічого.
    expect(res.status).toBe(404);
    expect(res.body.id).toBeUndefined();
  });

  it("на неіснуючий uuid повертає 404", async () => {
    const res = await request(app)
      .get(`/orders/${crypto.randomUUID()}`)
      .set("authorization", owner.auth);

    expect(res.status).toBe(404);
  });

  it("без токена повертає 401", async () => {
    const created = await createOrder(owner);

    const res = await request(app).get(`/orders/${created.id}`);

    expect(res.status).toBe(401);
  });
});
