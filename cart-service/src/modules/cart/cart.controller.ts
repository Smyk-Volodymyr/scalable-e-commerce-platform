import type { RequestHandler } from "express";
import { z } from "zod";
import { badRequest } from "@shop/shared/errors";
import { addItemSchema, setQuantitySchema } from "./cart.schemas.js";
import * as service from "./cart.service.js";

const uuidSchema = z.string().uuid();

function parseProductId(raw: unknown): string {
  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("Некоректний ідентифікатор товару");
  return parsed.data;
}

export const getCart: RequestHandler = async (req, res) => {
  res.json(await service.getCart(req.user!.sub));
};

export const addItem: RequestHandler = async (req, res) => {
  const parsed = addItemSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  const cart = await service.addItem(req.user!.sub, parsed.data.productId, parsed.data.quantity);
  res.status(201).json(cart);
};

export const setQuantity: RequestHandler = async (req, res) => {
  const parsed = setQuantitySchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  res.json(await service.setQuantity(req.user!.sub, parseProductId(req.params.productId), parsed.data.quantity));
};

export const removeItem: RequestHandler = async (req, res) => {
  res.json(await service.removeItem(req.user!.sub, parseProductId(req.params.productId)));
};

export const clear: RequestHandler = async (req, res) => {
  await service.clear(req.user!.sub);
  res.status(204).end();
};