import { query } from "../../db/pool.js";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
  updated_at: Date;
}

export async function findAll(): Promise<CategoryRow[]> {
  return query<CategoryRow>("SELECT * FROM categories ORDER BY name");
}

export async function findById(id: string): Promise<CategoryRow | undefined> {
  const rows = await query<CategoryRow>("SELECT * FROM categories WHERE id = $1", [id]);
  return rows[0];
}

export async function insert(data: { name: string; slug: string }): Promise<CategoryRow> {
  const rows = await query<CategoryRow>(
    "INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING *",
    [data.name, data.slug],
  );
  return rows[0]!;
}

export async function update(
  id: string,
  patch: { name?: string; slug?: string },
): Promise<CategoryRow | undefined> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined) { values.push(patch.name); fields.push(`name = $${values.length}`); }
  if (patch.slug !== undefined) { values.push(patch.slug); fields.push(`slug = $${values.length}`); }
  if (fields.length === 0) return findById(id);

  fields.push("updated_at = now()");
  values.push(id);

  const rows = await query<CategoryRow>(
    `UPDATE categories SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0];
}

export async function remove(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "DELETE FROM categories WHERE id = $1 RETURNING id",
    [id],
  );
  return rows.length > 0;
}