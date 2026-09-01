import { z } from "zod";

export const addItemSchema = z.object({
  productId: z.string().uuid("Некоректний ідентифікатор товару"),
  quantity: z.number().int().min(1).max(99).default(1),
});

export const setQuantitySchema = z.object({
  quantity: z.number().int().min(1).max(99),
});