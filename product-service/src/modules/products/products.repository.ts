import { query } from "../../db/pool.js";
import type { ListQuery } from "./products.schemas.js";

export interface ProductRow {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  stock: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function findMany(q: ListQuery): Promise<{ items: ProductRow[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (!q.includeInactive) where.push("is_active = true");

  if (q.categoryId) {
    values.push(q.categoryId);
    where.push(`category_id = $${values.length}`);
  }

  if (q.search) {
    values.push(`%${q.search}%`);
    where.push(`name ILIKE $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await query<{ count: string }>(
    `SELECT count(*) AS count FROM products ${whereSql}`,
    values,
  );
  const total = Number(countRows[0]?.count ?? 0);

  const offset = (q.page - 1) * q.limit;
  values.push(q.limit, offset);

  const items = await query<ProductRow>(
    `SELECT * FROM products ${whereSql}
     ORDER BY ${q.sort} ${q.order.toUpperCase()}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  return { items, total };
}

export async function findById(id: string): Promise<ProductRow | undefined> {
  const rows = await query<ProductRow>("SELECT * FROM products WHERE id = $1", [id]);
  return rows[0];
}

export async function findBySlug(slug: string): Promise<ProductRow | undefined> {
  const rows = await query<ProductRow>("SELECT * FROM products WHERE slug = $1", [slug]);
  return rows[0];
}

export async function insert(d: {
  categoryId: string; name: string; slug: string; description?: string | null;
  priceCents: number; currency: string; stock: number; isActive: boolean;
}): Promise<ProductRow> {
  const rows = await query<ProductRow>(
    `INSERT INTO products (category_id, name, slug, description, price_cents, currency, stock, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [d.categoryId, d.name, d.slug, d.description ?? null, d.priceCents, d.currency, d.stock, d.isActive],
  );
  return rows[0]!;
}

export async function update(id: string, patch: Record<string, unknown>): Promise<ProductRow | undefined> {
  const columnMap: Record<string, string> = {
    categoryId: "category_id", name: "name", slug: "slug", description: "description",
    priceCents: "price_cents", currency: "currency", stock: "stock", isActive: "is_active",
  };

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(columnMap)) {
    if (patch[key] !== undefined) {
      values.push(patch[key]);
      fields.push(`${column} = $${values.length}`);
    }
  }

  if (fields.length === 0) return findById(id);

  fields.push("updated_at = now()");
  values.push(id);

  const rows = await query<ProductRow>(
    `UPDATE products SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0];
}

export async function softDelete(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "UPDATE products SET is_active = false, updated_at = now() WHERE id = $1 AND is_active RETURNING id",
    [id],
  );
  return rows.length > 0;
}