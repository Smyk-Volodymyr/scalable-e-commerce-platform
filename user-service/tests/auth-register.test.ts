import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { registerUser, validCredentials } from "./helpers.js";

describe("POST /auth/register", () => {
  it("створює користувача і повертає 201 з id та email", async () => {
    const { res } = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: validCredentials.email,
      fullName: validCredentials.fullName,
      role: "customer",
    });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it("не віддає назовні ані хеш пароля, ані сам пароль", async () => {
    const { res } = await registerUser();

    // Перевіряємо і по ключах, і по сирому тілу: хеш не має протекти навіть
    // під іншим ім'ям поля або всередині вкладеного об'єкта.
    expect(res.body).not.toHaveProperty("password_hash");
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("password");
    expect(res.text).not.toContain("$2b$");
    expect(res.text).not.toContain(validCredentials.password);
  });

  it("відхиляє повторну реєстрацію того самого email кодом 409", async () => {
    const first = await registerUser();
    expect(first.res.status).toBe(201);

    const second = await registerUser();
    expect(second.res.status).toBe(409);
    expect(second.res.body.error).toBeTypeOf("string");
  });

  it("відхиляє пароль коротший за 8 символів кодом 400", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "short@example.com", password: "1234567" });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty("password");
  });
});
