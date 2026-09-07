import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { AppError, unauthorized } from "../errors.js";

export interface JwtPayload {
  sub: string;
  email: string;
  role: "customer" | "admin";
}

// Розширення типу лежить саме тут, а не в кожному сервісі: req.user з'являється
// рівно тому, що requireAuth його туди кладе, тож оголошення й код мають жити поруч.
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Фабрика, а не готовий middleware: JWT_SECRET приходить зі схеми оточення
// конкретного сервісу, і саме вона свідомо лишається локальною — у кожного
// сервісу свій набір змінних, спільною є тільки перевірка токена.
export function createAuth(jwtSecret: string): {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
} {
  const requireAuth: RequestHandler = (req, _res, next) => {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw unauthorized("Відсутній токен авторизації");
    }

    const token = header.slice("Bearer ".length);

    try {
      // issuer перевіряємо жорстко: токени випускає лише user-service, і сервіс,
      // що приймає чужий токен із тим самим секретом, — це діра, а не гнучкість.
      const payload = jwt.verify(token, jwtSecret, { issuer: "user-service" });

      if (typeof payload === "string") {
        throw unauthorized("Некоректний токен");
      }

      req.user = {
        sub: payload.sub as string,
        email: payload.email as string,
        // Будь-яке значення, крім рівно "admin", згортаємо до customer:
        // підвищення прав не має статись через несподіване значення в токені.
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

  const requireAdmin: RequestHandler = (req, _res, next) => {
    if (req.user?.role !== "admin") {
      throw new AppError(403, "Недостатньо прав");
    }
    next();
  };

  return { requireAuth, requireAdmin };
}
