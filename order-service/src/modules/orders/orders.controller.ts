import type { RequestHandler } from "express";
import { z } from "zod";
import { badRequest } from "../../utils/errors.js";
import * as service from "./orders.service.js";

const uuidSchema = z.string().uuid();
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const checkout: RequestHandler = async (req, res) => {
  const key = req.headers["idempotency-key"];
  if (typeof key !== "string" || key.length < 8 || key.length > 128) {
    throw badRequest("Потрібен заголовок Idempotency-Key (8–128 символів)");
  }

  const authHeader = req.headers.authorization!;
  res.status(201).json(await service.checkout(req.user!.sub, authHeader, key));
};

export const getById: RequestHandler = async (req, res) => {
  const parsed = uuidSchema.safeParse(req.params.id);
  if (!parsed.success) throw badRequest("Некоректний ідентифікатор");
  res.json(await service.getById(req.user!.sub, parsed.data));
};

export const list: RequestHandler = async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest("Некоректні параметри");
  res.json(await service.list(req.user!.sub, parsed.data.page, parsed.data.limit));
};

export const cancel: RequestHandler = async (req, res) => {
  const parsed = uuidSchema.safeParse(req.params.id);
  if (!parsed.success) throw badRequest("Некоректний ідентифікатор");
  res.json(await service.cancel(req.user!.sub, parsed.data));
};

export const markPaid: RequestHandler = async (req, res) => {
  const parsed = uuidSchema.safeParse(req.params.id);
  if (!parsed.success) throw badRequest("Некоректний ідентифікатор");
  await service.markPaid(parsed.data);
  res.status(204).end();
};

