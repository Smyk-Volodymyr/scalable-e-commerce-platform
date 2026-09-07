import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Єдиний зовнішній сервіс, який чіпає cart-service. Redis лишається реальним.
vi.mock("../src/clients/products.client.js", () => ({
  getProduct: vi.fn(),
}));

import { app } from "../src/app.js";
import { getProduct } from "../src/clients/products.client.js";
import { AppError } from "../src/utils/errors.js";
import { authHeader, makeProduct } from "./helpers.js";

const getProductMock = vi.mocked(getProduct);

const USER = "7f000000-0000-4000-8000-000000000001";
// UUID мають бути валідними за RFC (zod v4 перевіряє версію і варіант),
// інакше контролер відповість 400 замість очікуваного коду.
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

// Лічильники викликів не повинні текти між тестами: addItem/setQuantity
// смикають getProduct і напряму, і ще раз усередині getCart.
beforeEach(() => {
  vi.clearAllMocks();
});

async function seedItem(productId: string, quantity: number, product = makeProduct({ id: productId })) {
  getProductMock.mockResolvedValue(product);
  const res = await request(app)
    .post("/cart/items")
    .set("Authorization", authHeader(USER))
    .send({ productId, quantity });
  expect(res.status).toBe(201);
  return res;
}

describe("POST /cart/items", () => {
  it("додає товар і повертає 201 із порахованими сумами", async () => {
    getProductMock.mockResolvedValue(makeProduct({ id: PRODUCT_ID, priceCents: 250_00, stock: 10 }));

    const res = await request(app)
      .post("/cart/items")
      .set("Authorization", authHeader(USER))
      .send({ productId: PRODUCT_ID, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      productId: PRODUCT_ID,
      quantity: 2,
      priceCents: 250_00,
      subtotalCents: 500_00,
      inStock: true,
    });
    expect(res.body.totalCents).toBe(500_00);
    expect(res.body.itemCount).toBe(2);
  });

  it("повторне додавання того самого товару збільшує кількість, а не дублює позицію", async () => {
    getProductMock.mockResolvedValue(makeProduct({ id: PRODUCT_ID, priceCents: 100_00, stock: 10 }));

    await request(app)
      .post("/cart/items")
      .set("Authorization", authHeader(USER))
      .send({ productId: PRODUCT_ID, quantity: 2 });

    const res = await request(app)
      .post("/cart/items")
      .set("Authorization", authHeader(USER))
      .send({ productId: PRODUCT_ID, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(5);
    expect(res.body.items[0].subtotalCents).toBe(500_00);
    expect(res.body.totalCents).toBe(500_00);
  });

  it("повертає 409, якщо кількість перевищує залишок", async () => {
    getProductMock.mockResolvedValue(makeProduct({ id: PRODUCT_ID, stock: 2 }));

    const res = await request(app)
      .post("/cart/items")
      .set("Authorization", authHeader(USER))
      .send({ productId: PRODUCT_ID, quantity: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("2");
  });

  it("повертає 404 для неіснуючого товару", async () => {
    getProductMock.mockResolvedValue(null);

    const res = await request(app)
      .post("/cart/items")
      .set("Authorization", authHeader(USER))
      .send({ productId: PRODUCT_ID, quantity: 1 });

    expect(res.status).toBe(404);
    expect(getProductMock).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it("повертає 401 без токена", async () => {
    const res = await request(app).post("/cart/items").send({ productId: PRODUCT_ID, quantity: 1 });

    expect(res.status).toBe(401);
    expect(getProductMock).not.toHaveBeenCalled();
  });
});

describe("PATCH /cart/items/:productId", () => {
  it("змінює кількість і повертає 200 з новим значенням", async () => {
    await seedItem(PRODUCT_ID, 2, makeProduct({ id: PRODUCT_ID, priceCents: 100_00, stock: 10 }));

    const res = await request(app)
      .patch(`/cart/items/${PRODUCT_ID}`)
      .set("Authorization", authHeader(USER))
      .send({ quantity: 7 });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(7);
    expect(res.body.totalCents).toBe(700_00);
  });

  it("повертає 409, якщо нова кількість перевищує залишок", async () => {
    await seedItem(PRODUCT_ID, 1, makeProduct({ id: PRODUCT_ID, stock: 3 }));

    const res = await request(app)
      .patch(`/cart/items/${PRODUCT_ID}`)
      .set("Authorization", authHeader(USER))
      .send({ quantity: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("3");
  });

  it("повертає 404, якщо товару немає в кошику", async () => {
    getProductMock.mockResolvedValue(makeProduct({ id: OTHER_PRODUCT_ID }));

    const res = await request(app)
      .patch(`/cart/items/${OTHER_PRODUCT_ID}`)
      .set("Authorization", authHeader(USER))
      .send({ quantity: 2 });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /cart/items/:productId", () => {
  it("видаляє позицію з кошика", async () => {
    await seedItem(PRODUCT_ID, 2);

    const res = await request(app)
      .delete(`/cart/items/${PRODUCT_ID}`)
      .set("Authorization", authHeader(USER));

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);

    const after = await request(app).get("/cart").set("Authorization", authHeader(USER));
    expect(after.body.items).toEqual([]);
  });

  it("повертає 404 на повторне видалення", async () => {
    await seedItem(PRODUCT_ID, 1);

    await request(app).delete(`/cart/items/${PRODUCT_ID}`).set("Authorization", authHeader(USER));
    const res = await request(app)
      .delete(`/cart/items/${PRODUCT_ID}`)
      .set("Authorization", authHeader(USER));

    expect(res.status).toBe(404);
  });
});

describe("GET /cart", () => {
  it("повертає порожній кошик для користувача без позицій", async () => {
    const res = await request(app).get("/cart").set("Authorization", authHeader(USER));

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalCents).toBe(0);
    expect(res.body.itemCount).toBe(0);
    // Порожній кошик не має чого питати в каталогу.
    expect(getProductMock).not.toHaveBeenCalled();
  });
});

describe("недоступність каталогу", () => {
  it("віддає 503 при додаванні, якщо каталог недоступний", async () => {
    getProductMock.mockRejectedValue(new AppError(503, "Каталог тимчасово недоступний"));

    const res = await request(app)
      .post("/cart/items")
      .set("Authorization", authHeader(USER))
      .send({ productId: PRODUCT_ID, quantity: 1 });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Каталог тимчасово недоступний");
  });

  it("віддає 503 при читанні кошика, якщо каталог недоступний", async () => {
    await seedItem(PRODUCT_ID, 1);
    getProductMock.mockRejectedValue(new AppError(503, "Каталог тимчасово недоступний"));

    const res = await request(app).get("/cart").set("Authorization", authHeader(USER));

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Каталог тимчасово недоступний");
  });
});
