import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { unauthorized } from "../utils/errors.js";
import type { JwtPayload } from "../modules/users/users.service.js";

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

    req.user = { sub: payload.sub as string, email: payload.email as string };
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