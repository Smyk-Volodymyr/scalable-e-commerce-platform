import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { TEST_ENV } from "./test-env.js";
import { query } from "../src/db/pool.js";
import type { Cart, CartItem } from "../src/clients/cart.client.js";

export interface TestUser {
  id: string;
  email: string;
  token: string;
  auth: string;
}

// Токен підписуємо локально тим самим секретом і issuer, що їх перевіряє
// middleware/auth.ts: ходити по нього в user-service не можна й не потрібно.
export function signToken(payload: { sub: string; email: string; role?: "customer" | "admin" }): string {
  return jwt.sign(
    { sub: payload.sub, email: payload.email, role: payload.role ?? "customer" },
    TEST_ENV.JWT_SECRET!,
    { issuer: "user-service", expiresIn: "1h" },
  );
}

export function makeUser(role: "customer" | "admin" = "customer"): TestUser {
  const id = crypto.randomUUID();
  const email = `${id}@example.com`;
  const token = signToken({ sub: id, email, role });
  return { id, email, token, auth: `Bearer ${token}` };
}

export function cartItem(over: Partial<CartItem> = {}): CartItem {
  return {
    productId: crypto.randomUUID(),
    name: "Кава мелена",
    slug: "kava-melena",
    priceCents: 24_900,
    quantity: 2,
    inStock: true,
    ...over,
  };
}

export function makeCart(items: CartItem[] = [cartItem()]): Cart {
  return {
    items,
    totalCents: items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    currency: "UAH",
  };
}

export function makeReservation(orderId: string) {
  return {
    id: crypto.randomUUID(),
    orderId,
    status: "active",
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
  };
}

export interface OutboxRow {
  id: string;
  event_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
}

// Outbox читаємо напряму з БД: публікатор живе в server.ts і в тестах не стартує,
// тому подія має лишитись у таблиці неопублікованою.
export function readOutbox(aggregateId: string, eventType?: string): Promise<OutboxRow[]> {
  return eventType
    ? query<OutboxRow>(
        "SELECT id, event_type, aggregate_id, payload FROM outbox WHERE aggregate_id = $1 AND event_type = $2 ORDER BY created_at",
        [aggregateId, eventType],
      )
    : query<OutboxRow>(
        "SELECT id, event_type, aggregate_id, payload FROM outbox WHERE aggregate_id = $1 ORDER BY created_at",
        [aggregateId],
      );
}
