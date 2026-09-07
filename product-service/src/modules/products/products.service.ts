import { badRequest, conflict, isPgError, notFound } from "@shop/shared/errors";
import * as repo from "./products.repository.js";
import type { CreateProductInput, ListQuery, UpdateProductInput } from "./products.schemas.js";

export interface PublicProduct {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  currency: string;
  stock: number;
  inStock: boolean;
  isActive: boolean;
  createdAt: Date;
}

function toPublic(row: repo.ProductRow): PublicProduct {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    stock: row.stock,
    inStock: row.stock > 0,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function list(q: ListQuery) {
  const { items, total } = await repo.findMany(q);
  return {
    items: items.map(toPublic),
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.ceil(total / q.limit),
    },
  };
}

export async function getById(id: string): Promise<PublicProduct> {
  const row = await repo.findById(id);
  if (!row) throw notFound("Товар не знайдено");
  return toPublic(row);
}

export async function getBySlug(slug: string): Promise<PublicProduct> {
  const row = await repo.findBySlug(slug);
  if (!row) throw notFound("Товар не знайдено");
  return toPublic(row);
}

function handleDbError(err: unknown): never {
  if (isPgError(err)) {
    if (err.code === "23505") throw conflict("Товар з таким slug вже існує");
    if (err.code === "23503") throw badRequest("Вказаної категорії не існує");
    if (err.code === "23514") throw badRequest("Некоректне значення ціни або залишку");
  }
  throw err;
}

export async function create(input: CreateProductInput): Promise<PublicProduct> {
  try {
    return toPublic(await repo.insert(input));
  } catch (err) {
    handleDbError(err);
  }
}

export async function update(id: string, patch: UpdateProductInput): Promise<PublicProduct> {
  try {
    const row = await repo.update(id, patch);
    if (!row) throw notFound("Товар не знайдено");
    return toPublic(row);
  } catch (err) {
    handleDbError(err);
  }
}

export async function remove(id: string): Promise<void> {
  const ok = await repo.softDelete(id);
  if (!ok) throw notFound("Товар не знайдено або вже неактивний");
}