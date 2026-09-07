import type { RequestHandler } from "express";
import { z } from "zod";
import { badRequest } from "@shop/shared/errors";
import { createReservationSchema } from "./reservations.schemas.js";
import * as service from "./reservations.service.js";

const uuidSchema = z.string().uuid();

function parseId(raw: unknown): string {
  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("Некоректний ідентифікатор");
  return parsed.data;
}

export const create: RequestHandler = async (req, res) => {
  const parsed = createReservationSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  res.status(201).json(await service.create(parsed.data));
};

export const commit: RequestHandler = async (req, res) => {
  await service.commit(parseId(req.params.id));
  res.status(204).end();
};

export const cancel: RequestHandler = async (req, res) => {
  await service.cancel(parseId(req.params.id));
  res.status(204).end();
};

export const release: RequestHandler = async (req, res) => {
  await service.release(parseId(req.params.id));
  res.status(204).end();
};