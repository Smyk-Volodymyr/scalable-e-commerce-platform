import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { registerAndLogin, signToken, tamperSignature, validCredentials } from "./helpers.js";

describe("GET /users/me", () => {
  it("без заголовка Authorization повертає 401", async () => {
    const res = await request(app).get("/users/me");

    expect(res.status).toBe(401);
  });

  it("з валідним за структурою токеном, але поламаним підписом, повертає 401", async () => {
    const session = await registerAndLogin();
    const forged = tamperSignature(
      signToken({ sub: session.user.id, email: session.user.email }),
    );

    const res = await request(app).get("/users/me").set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty("email");
  });

  it("з валідним токеном повертає 200 і профіль саме цього користувача", async () => {
    const session = await registerAndLogin();

    const res = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(validCredentials.email);
    expect(res.body.id).toBe(session.user.id);
    expect(res.body).not.toHaveProperty("password_hash");
  });
});
