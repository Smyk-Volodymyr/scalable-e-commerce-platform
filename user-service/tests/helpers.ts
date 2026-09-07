import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../src/app.js";
import { TEST_ENV } from "./test-env.js";

export interface TokenClaims {
  sub: string;
  email: string;
  role?: "customer" | "admin";
}

// issuer обов'язковий: requireAuth перевіряє jwt.verify(..., { issuer: "user-service" }),
// і токен без нього дає 401 замість очікуваного 200.
export function signToken({ sub, email, role = "customer" }: TokenClaims): string {
  return jwt.sign({ sub, email, role }, TEST_ENV.JWT_SECRET!, {
    expiresIn: TEST_ENV.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: "user-service",
  });
}

// Ламає рівно підпис, лишаючи header і payload валідними — так перевіряється,
// що сервіс справді звіряє HMAC, а не просто декодує base64.
export function tamperSignature(token: string): string {
  const [header, payload, signature] = token.split(".");
  const flipped = signature!.slice(0, -1) + (signature!.endsWith("A") ? "B" : "A");
  return `${header}.${payload}.${flipped}`;
}

export const validCredentials = {
  email: "alice@example.com",
  password: "correct-horse-battery",
  fullName: "Alice Example",
};

export async function registerUser(overrides: Partial<typeof validCredentials> = {}) {
  const body = { ...validCredentials, ...overrides };
  const res = await request(app).post("/auth/register").send(body);
  return { res, body };
}

export async function loginUser(overrides: Partial<typeof validCredentials> = {}) {
  const { email, password } = { ...validCredentials, ...overrides };
  return request(app).post("/auth/login").send({ email, password });
}

// Зареєструвати і одразу залогінити — типовий пролог для тестів refresh і /users/me.
export async function registerAndLogin(overrides: Partial<typeof validCredentials> = {}) {
  await registerUser(overrides);
  const res = await loginUser(overrides);
  return res.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string };
  };
}
