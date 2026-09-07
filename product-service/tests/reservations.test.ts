import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { randomUuid, seedCategory, seedProduct, stockOf } from "./helpers.js";

let categoryId: string;
let productId: string;

beforeEach(async () => {
  categoryId = await seedCategory();
  productId = await seedProduct({ categoryId, name: "Reserved Item", stock: 10 });
});

describe("POST /internal/reservations", () => {
  it("успішний резерв -> 201 і stock зменшився рівно на quantity", async () => {
    const res = await request(app)
      .post("/internal/reservations")
      .send({ orderId: randomUuid(), items: [{ productId, quantity: 3 }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "active" });
    expect(res.body.id).toBeTypeOf("string");
    expect(await stockOf(productId)).toBe(7);
  });

  it("не потребує авторизації: працює без заголовка Authorization", async () => {
    const res = await request(app)
      .post("/internal/reservations")
      .send({ orderId: randomUuid(), items: [{ productId, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(await stockOf(productId)).toBe(9);
  });

  it("повтор із тим самим orderId повертає той самий id і не списує stock двічі", async () => {
    const orderId = randomUuid();
    const payload = { orderId, items: [{ productId, quantity: 4 }] };

    const first = await request(app).post("/internal/reservations").send(payload);
    expect(first.status).toBe(201);
    expect(await stockOf(productId)).toBe(6);

    const second = await request(app).post("/internal/reservations").send(payload);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(await stockOf(productId)).toBe(6);
  });

  it("нестача товару -> 409, транзакція відкотилась і stock не змінився", async () => {
    const orderId = randomUuid();

    const res = await request(app)
      .post("/internal/reservations")
      .send({ orderId, items: [{ productId, quantity: 11 }] });

    expect(res.status).toBe(409);
    expect(await stockOf(productId)).toBe(10);

    // Рядок резерву теж має відкотитись, інакше orderId лишиться зайнятим назавжди.
    const retry = await request(app)
      .post("/internal/reservations")
      .send({ orderId, items: [{ productId, quantity: 2 }] });
    expect(retry.status).toBe(201);
    expect(await stockOf(productId)).toBe(8);
  });

  it("нестача в другій позиції відкочує списання за першою", async () => {
    const otherId = await seedProduct({ categoryId, name: "Second Item", stock: 1 });

    const res = await request(app)
      .post("/internal/reservations")
      .send({
        orderId: randomUuid(),
        items: [
          { productId, quantity: 2 },
          { productId: otherId, quantity: 5 },
        ],
      });

    expect(res.status).toBe(409);
    expect(await stockOf(productId)).toBe(10);
    expect(await stockOf(otherId)).toBe(1);
  });
});

describe("DELETE /internal/reservations/:id", () => {
  it("скасування -> 204 і stock повернувся", async () => {
    const created = await request(app)
      .post("/internal/reservations")
      .send({ orderId: randomUuid(), items: [{ productId, quantity: 3 }] });
    expect(created.status).toBe(201);
    expect(await stockOf(productId)).toBe(7);

    const cancelled = await request(app).delete(`/internal/reservations/${created.body.id}`);

    expect(cancelled.status).toBe(204);
    expect(await stockOf(productId)).toBe(10);
  });

  it("подвійне скасування не подвоює повернення stock", async () => {
    const created = await request(app)
      .post("/internal/reservations")
      .send({ orderId: randomUuid(), items: [{ productId, quantity: 3 }] });

    const first = await request(app).delete(`/internal/reservations/${created.body.id}`);
    expect(first.status).toBe(204);
    expect(await stockOf(productId)).toBe(10);

    const second = await request(app).delete(`/internal/reservations/${created.body.id}`);
    expect(second.status).toBe(204);
    expect(await stockOf(productId)).toBe(10);
  });
});
