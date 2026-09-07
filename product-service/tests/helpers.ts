import jwt from "jsonwebtoken";
import { pool } from "../src/db/pool.js";
import { TEST_ENV } from "./test-env.js";

export interface TokenPayload {
  sub: string;
  email: string;
  role: "customer" | "admin";
}

// Токен підписуємо локально тим самим секретом і issuer, що їх перевіряє
// requireAuth. Ходити в user-service заради тесту product-service не можна:
// це зробило б тест залежним від чужого сервісу.
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, TEST_ENV.JWT_SECRET!, {
    issuer: "user-service",
    expiresIn: "1h",
  });
}

export const adminToken = () =>
  signToken({ sub: "11111111-1111-1111-1111-111111111111", email: "admin@shop.test", role: "admin" });

export const customerToken = () =>
  signToken({ sub: "22222222-2222-2222-2222-222222222222", email: "user@shop.test", role: "customer" });

export function authHeader(token: string): [string, string] {
  return ["Authorization", `Bearer ${token}`];
}

let seq = 0;
const uniq = () => `${Date.now().toString(36)}-${++seq}`;

export async function seedCategory(name = "Kitchen"): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id",
    [name, `cat-${uniq()}`],
  );
  return rows[0]!.id;
}

export interface SeedProduct {
  categoryId: string;
  name?: string;
  priceCents?: number;
  stock?: number;
  isActive?: boolean;
}

export async function seedProduct(p: SeedProduct): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO products (category_id, name, slug, price_cents, stock, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      p.categoryId,
      p.name ?? "Product",
      `p-${uniq()}`,
      p.priceCents ?? 1000,
      p.stock ?? 0,
      p.isActive ?? true,
    ],
  );
  return rows[0]!.id;
}

// Залишок читаємо напряму з БД: HTTP-відповідь резервування його не повертає,
// а перевіряти треба саме число в таблиці.
export async function stockOf(productId: string): Promise<number> {
  const { rows } = await pool.query<{ stock: number }>(
    "SELECT stock FROM products WHERE id = $1",
    [productId],
  );
  return rows[0]!.stock;
}

export function randomUuid(): string {
  return crypto.randomUUID();
}
