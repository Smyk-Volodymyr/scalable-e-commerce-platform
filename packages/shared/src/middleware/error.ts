import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../errors.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Роут ${req.method} ${req.path} не існує` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }

  console.error("Необроблена помилка:", err);
  res.status(500).json({ error: "Внутрішня помилка сервера" });
};
