import { conflict, isPgError, notFound, badRequest } from "@shop/shared/errors";
import * as repo from "./categories.repository.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schemas.js";

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

function toPublic(row: repo.CategoryRow): PublicCategory {
  return { id: row.id, name: row.name, slug: row.slug };
}

export async function list(): Promise<PublicCategory[]> {
  return (await repo.findAll()).map(toPublic);
}

export async function getById(id: string): Promise<PublicCategory> {
  const row = await repo.findById(id);
  if (!row) throw notFound("Категорію не знайдено");
  return toPublic(row);
}

export async function create(input: CreateCategoryInput): Promise<PublicCategory> {
  try {
    return toPublic(await repo.insert(input));
  } catch (err) {
    if (isPgError(err) && err.code === "23505") throw conflict("Категорія з таким slug вже існує");
    throw err;
  }
}

export async function update(id: string, patch: UpdateCategoryInput): Promise<PublicCategory> {
  try {
    const row = await repo.update(id, patch);
    if (!row) throw notFound("Категорію не знайдено");
    return toPublic(row);
  } catch (err) {
    if (isPgError(err) && err.code === "23505") throw conflict("Категорія з таким slug вже існує");
    throw err;
  }
}

export async function remove(id: string): Promise<void> {
  try {
    const deleted = await repo.remove(id);
    if (!deleted) throw notFound("Категорію не знайдено");
  } catch (err) {
    if (isPgError(err) && err.code === "23503") {
      throw badRequest("Не можна видалити категорію, у якій є товари");
    }
    throw err;
  }
}