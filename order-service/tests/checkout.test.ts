import crypto from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Мокаємо ЛИШЕ зовнішні сервіси. БД — справжня, у Docker.
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
import { cartItem, makeCart, makeReservation, makeUser, readOutbox } from "./helpers.js";

const getCart = vi.mocked(cartClient.getCart);
const clearCart = vi.mocked(cartClient.clearCart);
const createReservation = vi.mocked(productClient.createReservation);
const commitReservation = vi.mocked(productClient.commitReservation);

describe("POST /orders/checkout", () => {
  let user: ReturnType<typeof makeUser>;
  let lastReservation: ReturnType<typeof makeReservation> | undefined;

  beforeEach(() => {
    user = makeUser();
    lastReservation = undefined;
    getCart.mockResolvedValue(makeCart());
    clearCart.mockResolvedValue(undefined);
    createReservation.mockImplementation(async (orderId) => {
      lastReservation = makeReservation(orderId);
      return lastReservation;
    });
    commitReservation.mockResolvedValue(undefined);
  });

  it("без заголовка Idempotency-Key повертає 400", async () => {
    const res = await request(app).post("/orders/checkout").set("authorization", user.auth);

    expect(res.status).toBe(400);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("з надто коротким Idempotency-Key повертає 400", async () => {
    const res = await request(app)
      .post("/orders/checkout")
      .set("authorization", user.auth)
      .set("idempotency-key", "1234567"); // 7 символів — на один менше за мінімум

    expect(res.status).toBe(400);
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("без токена повертає 401", async () => {
    const res = await request(app)
      .post("/orders/checkout")
      .set("idempotency-key", crypto.randomUUID());

    expect(res.status).toBe(401);
  });

  it("на порожній кошик повертає 400 і не резервує товар", async () => {
    getCart.mockResolvedValue(makeCart([]));

    const res = await request(app)
      .post("/orders/checkout")
      .set("authorization", user.auth)
      .set("idempotency-key", crypto.randomUUID());

    expect(res.status).toBe(400);
    expect(createReservation).not.toHaveBeenCalled();
    expect(await query("SELECT id FROM orders")).toHaveLength(0);
  });

  it("створює замовлення з позиціями і сумою кошика", async () => {
    const items = [
      cartItem({ name: "Кава", slug: "kava", priceCents: 24_900, quantity: 2 }),
      cartItem({ name: "Чай", slug: "chai", priceCents: 10_050, quantity: 3 }),
    ];
    const cart = makeCart(items);
    getCart.mockResolvedValue(cart);

    const res = await request(app)
      .post("/orders/checkout")
      .set("authorization", user.auth)
      .set("idempotency-key", crypto.randomUUID());

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.totalCents).toBe(cart.totalCents);
    expect(res.body.currency).toBe("UAH");
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((i: { productId: string }) => i.productId).sort())
      .toEqual(items.map((i) => i.productId).sort());

    const rows = await query<{ id: string; user_id: string; total_cents: number; reservation_id: string }>(
      "SELECT id, user_id, total_cents, reservation_id FROM orders",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(res.body.id);
    expect(rows[0]!.user_id).toBe(user.id);
    expect(rows[0]!.total_cents).toBe(cart.totalCents);
    expect(rows[0]!.reservation_id).toBe(lastReservation!.id);

    const dbItems = await query<{ quantity: number }>("SELECT quantity FROM order_items WHERE order_id = $1", [res.body.id]);
    expect(dbItems).toHaveLength(2);

    // Резерв створено на той самий id, який отримало замовлення, і підтверджено.
    expect(createReservation).toHaveBeenCalledTimes(1);
    expect(createReservation.mock.calls[0]![0]).toBe(res.body.id);
    expect(commitReservation).toHaveBeenCalledTimes(1);
    expect(clearCart).toHaveBeenCalledTimes(1);

    const events = await readOutbox(res.body.id, "order.created");
    expect(events).toHaveLength(1);
  });

  it("повторний checkout із тим самим Idempotency-Key повертає те саме замовлення і резервує рівно один раз", async () => {
    const key = crypto.randomUUID();

    const first = await request(app)
      .post("/orders/checkout")
      .set("authorization", user.auth)
      .set("idempotency-key", key);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/orders/checkout")
      .set("authorization", user.auth)
      .set("idempotency-key", key);

    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.totalCents).toBe(first.body.totalCents);
    // order_items читаються без ORDER BY, тож порівнюємо як множини.
    const byProduct = (a: { productId: string }, b: { productId: string }) =>
      a.productId.localeCompare(b.productId);
    expect([...second.body.items].sort(byProduct)).toEqual([...first.body.items].sort(byProduct));

    // Головна перевірка сервісу: повтор не має резервувати склад удруге.
    expect(createReservation).toHaveBeenCalledTimes(1);
    expect(await query("SELECT id FROM orders")).toHaveLength(1);
    expect(await readOutbox(first.body.id, "order.created")).toHaveLength(1);
  });

  // Простір ключів ідемпотентності — на КОЖНОГО користувача, а не глобальний.
  // Клієнти генерують ключі незалежно, тож збіг між двома користувачами — питання
  // часу, а не зловмисності. Складений PRIMARY KEY (key, user_id) з міграції 004
  // робить такий збіг нецікавим: обидва checkout проходять як звичайні.
  it("той самий Idempotency-Key від іншого користувача створює окреме замовлення", async () => {
    const key = crypto.randomUUID();
    const other = makeUser();

    const first = await request(app)
      .post("/orders/checkout")
      .set("authorization", user.auth)
      .set("idempotency-key", key);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/orders/checkout")
      .set("authorization", other.auth)
      .set("idempotency-key", key);

    expect(second.status).toBe(201);

    // Чужий ключ не має віддавати чуже замовлення — це окреме замовлення,
    // а не повторна видача першого.
    expect(second.body.id).not.toBe(first.body.id);
    expect(createReservation).toHaveBeenCalledTimes(2);

    const owners = await query<{ id: string; user_id: string }>("SELECT id, user_id FROM orders");
    expect(owners).toHaveLength(2);
    expect(owners.map((r) => r.user_id).sort()).toEqual([user.id, other.id].sort());
    // Перше замовлення лишилось за своїм власником.
    expect(owners.find((r) => r.id === first.body.id)!.user_id).toBe(user.id);
  });
});
