import type { RequestHandler } from "express";
import { z } from "zod";
import { badRequest } from "@shop/shared/errors";
import { env } from "../../config/env.js";
import { stripe } from "../../lib/stripe.js";
import * as service from "./payments.service.js";

const createSchema = z.object({ orderId: z.string().uuid() });

export const createIntent: RequestHandler = async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Некоректні дані", parsed.error.flatten().fieldErrors);
  res.status(201).json(
    await service.createIntent(req.user!.sub, parsed.data.orderId, req.headers.authorization!),
  );
};

export const getByOrder: RequestHandler = async (req, res) => {
  const parsed = z.string().uuid().safeParse(req.params.orderId);
  if (!parsed.success) throw badRequest("Некоректний ідентифікатор");
  res.json(await service.getByOrderId(req.user!.sub, parsed.data));
};

export const webhook: RequestHandler = async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ error: "Відсутній підпис" });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Некоректний підпис вебхука:", err);
    res.status(400).json({ error: "Некоректний підпис" });
    return;
  }

  try {
    await service.handleEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error("Помилка обробки події:", err);
    res.status(500).json({ error: "Помилка обробки" });
  }
};