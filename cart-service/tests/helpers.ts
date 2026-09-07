import jwt from "jsonwebtoken";
import { TEST_ENV } from "./test-env.js";
import type { CatalogProduct } from "../src/clients/products.client.js";

// Сервіс лише перевіряє підпис локально, тож ходити в user-service не треба:
// issuer має збігатися з тим, що очікує requireAuth.
export function signToken(payload: { sub: string; email: string; role?: "customer" | "admin" }): string {
  return jwt.sign(
    { sub: payload.sub, email: payload.email, role: payload.role ?? "customer" },
    TEST_ENV.JWT_SECRET!,
    { issuer: "user-service", expiresIn: "1h" },
  );
}

export function authHeader(userId: string): string {
  return `Bearer ${signToken({ sub: userId, email: `${userId}@example.com` })}`;
}

export function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Кавоварка",
    slug: "kavovarka",
    priceCents: 250_00,
    currency: "UAH",
    stock: 10,
    isActive: true,
    ...overrides,
  };
}
