import type { RequestHandler } from "express";
import { badRequest } from "@shop/shared/errors";
import { loginSchema, refreshSchema, registerSchema, updateMeSchema } from "./users.schemas.js";
import * as service from "./users.service.js";

export const register: RequestHandler = async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  }

  const user = await service.register(parsed.data);

  res.status(201).json(user);
};

export const login: RequestHandler = async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  }

  const result = await service.login(parsed.data);
  res.json(result);
};

export const getMe: RequestHandler = async (req, res) => {
  const user = await service.getById(req.user!.sub);
  res.json(user);
};

export const updateMe: RequestHandler = async (req, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  }

  const user = await service.updateMe(req.user!.sub, parsed.data);
  res.json(user);
};

export const refresh: RequestHandler = async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  res.json(await service.refresh(parsed.data.refreshToken));
};

export const logout: RequestHandler = async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  await service.logout(parsed.data.refreshToken);
  res.status(204).end();  
};