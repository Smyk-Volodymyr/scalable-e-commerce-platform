import type { RequestHandler } from "express";
import { z } from "zod";
import { badRequest } from "@shop/shared/errors";
import { createCategorySchema, updateCategorySchema } from "./categories.schemas.js";
import * as service from "./categories.service.js";

const uuidSchema = z.uuid("Некоректний ідентифікатор");

function parseId(raw: unknown): string {
  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("Некоректний ідентифікатор");
  return parsed.data;
}

export const list: RequestHandler = async (_req, res) => {
  res.json(await service.list());
};

export const getById: RequestHandler = async (req, res) => {
  res.json(await service.getById(parseId(req.params.id)));
};

export const create: RequestHandler = async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  res.status(201).json(await service.create(parsed.data));
};

export const update: RequestHandler = async (req, res) => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  res.json(await service.update(parseId(req.params.id), parsed.data));
};

export const remove: RequestHandler = async (req, res) => {
  await service.remove(parseId(req.params.id));
  res.status(204).end();
};