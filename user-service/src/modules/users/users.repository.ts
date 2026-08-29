import { query } from "../../db/pool.js";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  created_at: Date;
  updated_at: Date;
  role: "customer" | "admin";
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export async function findByEmail(email: string): Promise<UserRow | undefined> {
  const rows = await query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0];
}

export async function insertUser(data: {
  email: string;
  passwordHash: string;
  fullName?: string;
}): Promise<UserRow> {
  const rows = await query<UserRow>(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.email, data.passwordHash, data.fullName ?? null],
  );
  return rows[0]!;
}

export async function findById(id: string): Promise<UserRow | undefined> {
  const rows = await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0];
}

export async function updateUser(
  id: string,
  patch: { email?: string; fullName?: string | null },
): Promise<UserRow | undefined> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.email !== undefined) {
    values.push(patch.email);
    fields.push(`email = $${values.length}`);
  }
  if (patch.fullName !== undefined) {
    values.push(patch.fullName);
    fields.push(`full_name = $${values.length}`);
  }

  if (fields.length === 0) return findById(id);

  fields.push("updated_at = now()");
  
  values.push(id);
  const rows = await query<UserRow>(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  return rows[0];
}

export async function insertRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | undefined> {
  const rows = await query<RefreshTokenRow>(
    "SELECT * FROM refresh_tokens WHERE token_hash = $1",
    [tokenHash],
  );
  return rows[0];
}

export async function revokeRefreshToken(id: string): Promise<void> {
  await query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [id]);
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await query(
    "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );
}