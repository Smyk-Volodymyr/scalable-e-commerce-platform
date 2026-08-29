import type { RequestHandler } from "express";
import { z } from "zod";
import { badRequest } from "../../utils/errors.js";
import { createProductSchema, listQuerySchema, updateProductSchema } from "./products.schemas.js";
import * as service from "./products.service.js";

const uuidSchema = z.string().uuid("Некоректний ідентифікатор");

function parseId(raw: unknown): string {
  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("Некоректний ідентифікатор");
  return parsed.data;
}

export const list: RequestHandler = async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest("Некоректні параметри", parsed.error.flatten().fieldErrors);
  res.json(await service.list(parsed.data));
};

export const getById: RequestHandler = async (req, res) => {
  res.json(await service.getById(parseId(req.params.id)));
};

export const getBySlug: RequestHandler = async (req, res) => {
  const slug = String(req.params.slug ?? "");
  if (!slug) throw badRequest("Некоректний slug");
  res.json(await service.getBySlug(slug));
};

export const create: RequestHandler = async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  res.status(201).json(await service.create(parsed.data));
};

export const update: RequestHandler = async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  res.json(await service.update(parseId(req.params.id), parsed.data));
};

export const remove: RequestHandler = async (req, res) => {
  await service.remove(parseId(req.params.id));
  res.status(204).end();
};