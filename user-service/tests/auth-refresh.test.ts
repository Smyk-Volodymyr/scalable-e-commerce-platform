import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { registerAndLogin } from "./helpers.js";

const refresh = (refreshToken: string) =>
  request(app).post("/auth/refresh").send({ refreshToken });

describe("POST /auth/refresh", () => {
  it("ротує сесію: видає нову пару, refreshToken відрізняється від старого", async () => {
    const initial = await registerAndLogin();

    const res = await refresh(initial.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(initial.refreshToken);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(initial.user.email);
  });

  it("на повторне використання витраченого токена відповідає 401 і гасить усі сесії користувача", async () => {
    const initial = await registerAndLogin();

    const rotated = await refresh(initial.refreshToken);
    expect(rotated.status).toBe(200);
    const freshToken = rotated.body.refreshToken as string;

    // Повторне пред'явлення вже витраченого токена — ознака крадіжки: сервіс має
    // не просто відмовити, а анулювати всі живі refresh-токени користувача.
    const reused = await refresh(initial.refreshToken);
    expect(reused.status).toBe(401);

    // Головна перевірка reuse detection: щойно видана легітимна пара теж мертва.
    const afterReuse = await refresh(freshToken);
    expect(afterReuse.status).toBe(401);
  });

  it("відхиляє невідомий refresh-токен кодом 401", async () => {
    await registerAndLogin();

    const res = await refresh("token-that-was-never-issued");

    expect(res.status).toBe(401);
  });
});
