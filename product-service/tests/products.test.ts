import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { adminToken, customerToken, seedCategory, seedProduct } from "./helpers.js";

let categoryId: string;

beforeEach(async () => {
  categoryId = await seedCategory();
});

describe("POST /products", () => {
  const body = () => ({
    categoryId,
    name: "Espresso Machine",
    slug: "espresso-machine",
    priceCents: 12_900,
    stock: 5,
  });

  it("адмін створює товар -> 201", async () => {
    const res = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send(body());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      categoryId,
      name: "Espresso Machine",
      slug: "espresso-machine",
      priceCents: 12_900,
      stock: 5,
      inStock: true,
      isActive: true,
      currency: "UAH",
    });
    expect(res.body.id).toBeTypeOf("string");
  });

  it("покупцеві заборонено -> 403", async () => {
    const res = await request(app)
      .post("/products")
      .set("Authorization", `Bearer ${customerToken()}`)
      .send(body());

    expect(res.status).toBe(403);
  });

  it("без токена -> 401", async () => {
    const res = await request(app).post("/products").send(body());

    expect(res.status).toBe(401);
  });
});

describe("GET /products", () => {
  it("пагінація: page/limit і блок pagination", async () => {
    // 25 товарів при limit=10 дають рівно 3 сторінки, остання — неповна.
    for (let i = 1; i <= 25; i += 1) {
      await seedProduct({ categoryId, name: `item-${String(i).padStart(2, "0")}` });
    }

    const first = await request(app).get("/products?page=1&limit=10&sort=name&order=asc");
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(10);
    expect(first.body.pagination).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
    expect(first.body.items[0].name).toBe("item-01");

    const last = await request(app).get("/products?page=3&limit=10&sort=name&order=asc");
    expect(last.status).toBe(200);
    expect(last.body.items).toHaveLength(5);
    expect(last.body.pagination).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 });
    expect(last.body.items[0].name).toBe("item-21");
  });

  it("фільтр categoryId повертає лише товари цієї категорії", async () => {
    const otherCategoryId = await seedCategory("Garden");
    await seedProduct({ categoryId, name: "kettle" });
    await seedProduct({ categoryId, name: "mug" });
    await seedProduct({ categoryId: otherCategoryId, name: "shovel" });

    const res = await request(app).get(`/products?categoryId=${categoryId}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.items.map((p: { name: string }) => p.name).sort()).toEqual(["kettle", "mug"]);
    for (const item of res.body.items) expect(item.categoryId).toBe(categoryId);
  });

  it("фільтр search збігається частково і без урахування регістру (ILIKE)", async () => {
    await seedProduct({ categoryId, name: "Blue Kettle" });
    await seedProduct({ categoryId, name: "Red Kettle" });
    await seedProduct({ categoryId, name: "Blue Mug" });

    const res = await request(app).get("/products?search=kett");

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.items.map((p: { name: string }) => p.name).sort())
      .toEqual(["Blue Kettle", "Red Kettle"]);
  });

  it("сортування ?sort=price_cents&order=asc дає зростання цін", async () => {
    await seedProduct({ categoryId, name: "c", priceCents: 300 });
    await seedProduct({ categoryId, name: "a", priceCents: 100 });
    await seedProduct({ categoryId, name: "b", priceCents: 200 });

    const res = await request(app).get("/products?sort=price_cents&order=asc");

    expect(res.status).toBe(200);
    expect(res.body.items.map((p: { priceCents: number }) => p.priceCents)).toEqual([100, 200, 300]);
  });

  it("невалідний sort -> 400: enum-білий-список захищає ORDER BY від підстановки", async () => {
    await seedProduct({ categoryId, name: "any" });

    const res = await request(app).get("/products?sort=price_cents;DROP TABLE products");

    expect(res.status).toBe(400);
    // Таблиця має лишитись на місці — рядок навіть не дійшов до SQL.
    const still = await request(app).get("/products");
    expect(still.status).toBe(200);
    expect(still.body.pagination.total).toBe(1);
  });
});
