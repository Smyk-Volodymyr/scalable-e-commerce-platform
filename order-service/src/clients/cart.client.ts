import { env } from "../config/env.js";
import { AppError } from "@shop/shared/errors";

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  quantity: number;
  inStock: boolean;
}

export interface Cart {
  items: CartItem[];
  totalCents: number;
  currency: string;
}

export async function getCart(authHeader: string): Promise<Cart> {
  try {
    const res = await fetch(`${env.CART_SERVICE_URL}/cart`, {
      signal: AbortSignal.timeout(3000),
      headers: { authorization: authHeader, accept: "application/json" },
    });
    if (!res.ok) throw new AppError(502, "Не вдалося прочитати кошик");
    return (await res.json()) as Cart;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(503, "Сервіс кошика недоступний");
  }
}

export async function clearCart(authHeader: string): Promise<void> {
  try {
    await fetch(`${env.CART_SERVICE_URL}/cart`, {
      method: "DELETE",
      signal: AbortSignal.timeout(3000),
      headers: { authorization: authHeader },
    });
  } catch (err) {
    console.error("Не вдалося очистити кошик:", err);
  }
}