import bcrypt from "bcryptjs";
import { env } from "../../config/env.js";
import { conflict, isPgError, unauthorized } from "@shop/shared/errors";
import * as repo from "./users.repository.js";
import type { LoginInput, RegisterInput, UpdateMeInput } from "./users.schemas.js";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

export interface PublicUser {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: Date;
  role: "customer" | "admin";
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface JwtPayload {
  sub: string;  
  email: string;
  role: "customer" | "admin";
}

export function toPublicUser(row: repo.UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    createdAt: row.created_at,
    role: row.role,
  };
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  const existing = await repo.findByEmail(input.email);
  if (existing) {
    throw conflict("Користувач з таким email вже існує");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  try {
    const row = await repo.insertUser({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
    });
    return toPublicUser(row);
  } catch (err: unknown) {
  if (isPgError(err) && err.code === "23505") {
    throw conflict("Користувач з таким email вже існує");
  }
  throw err; 
}
}

function signToken(user: repo.UserRow): string {
  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: "user-service", 
  });
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const row = await repo.findByEmail(input.email);

  if (!row) {
    throw unauthorized("Невірний email або пароль");
  }

  const passwordMatches = await bcrypt.compare(input.password, row.password_hash);
  if (!passwordMatches) {
    throw unauthorized("Невірний email або пароль"); 
  }

  return issueTokens(row);
}

import { notFound } from "@shop/shared/errors";

export async function getById(id: string): Promise<PublicUser> {
  const row = await repo.findById(id);
  if (!row) {
    throw notFound("Користувача не знайдено");
  }
  return toPublicUser(row);
}

export async function updateMe(id: string, patch: UpdateMeInput): Promise<PublicUser> {
  try {
    const row = await repo.updateUser(id, patch);
    if (!row) throw notFound("Користувача не знайдено");
    return toPublicUser(row);
  } catch (err: unknown) {
    if (isPgError(err) && err.code === "23505") {
      throw conflict("Цей email вже зайнятий");
    }
    throw err;
  }
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function issueTokens(row: repo.UserRow): Promise<AuthResult> {
  const refreshToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await repo.insertRefreshToken(row.id, hashToken(refreshToken), expiresAt);

  return { accessToken: signToken(row), refreshToken, user: toPublicUser(row) };
}

export async function refresh(rawToken: string): Promise<AuthResult> {
  const stored = await repo.findRefreshToken(hashToken(rawToken));
  if (!stored) throw unauthorized("Некоректний refresh-токен");

  if (stored.revoked_at) {
    await repo.revokeAllForUser(stored.user_id);
    throw unauthorized("Сесію скомпрометовано, увійдіть знову");
  }

  if (stored.expires_at.getTime() < Date.now()) {
    throw unauthorized("Термін дії сесії вичерпано");
  }

  const user = await repo.findById(stored.user_id);
  if (!user) throw unauthorized("Користувача не знайдено");

  await repo.revokeRefreshToken(stored.id);
  return issueTokens(user);
}

export async function logout(rawToken: string): Promise<void> {
  const stored = await repo.findRefreshToken(hashToken(rawToken));
  if (stored && !stored.revoked_at) {
    await repo.revokeRefreshToken(stored.id);
  }
}