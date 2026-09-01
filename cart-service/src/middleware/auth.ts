import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError, unauthorized } from "../utils/errors.js";

export interface JwtPayload {
  sub: string;
  email: string;
  role: "customer" | "admin";
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw unauthorized("Відсутній токен авторизації");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "user-service" });

    if (typeof payload === "string") {
      throw unauthorized("Некоректний токен");
    }

    req.user = {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role === "admin" ? "admin" : "customer",
  };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw unauthorized("Термін дії токена вичерпано");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw unauthorized("Некоректний токен");
    }
    throw err;
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "admin") {
    throw new AppError(403, "Недостатньо прав");
  }
  next();
};