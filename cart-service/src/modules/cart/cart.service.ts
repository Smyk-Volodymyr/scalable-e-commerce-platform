import { badRequest, conflict, notFound } from "@shop/shared/errors";
import * as client from "../../clients/products.client.js";
import * as repo from "./cart.repository.js";

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  quantity: number;
  subtotalCents: number;
  inStock: boolean;
}

export interface Cart {
  items: CartItem[];
  totalCents: number;
  currency: string;
  itemCount: number;
}

export async function getCart(userId: string): Promise<Cart> {
  const stored = await repo.getItems(userId);
  const ids = Object.keys(stored);

  if (ids.length === 0) {
    return { items: [], totalCents: 0, currency: "UAH", itemCount: 0 };
  }

  const products = await Promise.all(ids.map((id) => client.getProduct(id)));

  const items: CartItem[] = [];

  for (const [i, product] of products.entries()) {
    const productId = ids[i]!;

    if (!product || !product.isActive) {
      await repo.removeItem(userId, productId);
      continue;
    }

    const quantity = stored[productId]!;
    items.push({
      productId,
      name: product.name,
      slug: product.slug,
      priceCents: product.priceCents,
      quantity,
      subtotalCents: product.priceCents * quantity,
      inStock: product.stock >= quantity,
    });
  }

  return {
    items,
    totalCents: items.reduce((sum, i) => sum + i.subtotalCents, 0),
    currency: items[0] ? "UAH" : "UAH",
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

export async function addItem(userId: string, productId: string, quantity: number): Promise<Cart> {
  const product = await client.getProduct(productId);

  if (!product) throw notFound("Товар не знайдено");
  if (!product.isActive) throw badRequest("Товар недоступний");

  const current = await repo.getItems(userId);
  const newQuantity = (current[productId] ?? 0) + quantity;

  if (newQuantity > 99) throw badRequest("Максимум 99 одиниць одного товару");

  if (product.stock < newQuantity) {
    throw conflict(`Доступно лише ${product.stock} од.`);
  }

  await repo.setItem(userId, productId, newQuantity);
  return getCart(userId);
}

export async function setQuantity(userId: string, productId: string, quantity: number): Promise<Cart> {
  const current = await repo.getItems(userId);
  if (current[productId] === undefined) throw notFound("Товару немає в кошику");

  const product = await client.getProduct(productId);
  if (!product || !product.isActive) {
    await repo.removeItem(userId, productId);
    throw notFound("Товар більше недоступний");
  }

  if (product.stock < quantity) throw conflict(`Доступно лише ${product.stock} од.`);

  await repo.setItem(userId, productId, quantity);
  return getCart(userId);
}

export async function removeItem(userId: string, productId: string): Promise<Cart> {
  const removed = await repo.removeItem(userId, productId);
  if (!removed) throw notFound("Товару немає в кошику");
  return getCart(userId);
}

export async function clear(userId: string): Promise<void> {
  await repo.clear(userId);
}