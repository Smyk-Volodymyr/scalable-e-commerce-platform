import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createProductSchema = z.object({
  categoryId: z.string().uuid("Некоректний ідентифікатор категорії"),
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().toLowerCase().min(1).max(200).regex(slugRegex, "Некоректний slug"),
  description: z.string().trim().max(5000).nullable().optional(),

  priceCents: z.number().int().min(0, "Ціна не може бути відʼємною"),

  currency: z.string().length(3).toUpperCase().default("UAH"),
  stock: z.number().int().min(0, "Залишок не може бути відʼємним").default(0),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial().strict()
  .refine((d) => Object.keys(d).length > 0, { message: "Потрібно передати хоча б одне поле" });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: z.enum(["created_at", "price_cents", "name"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  includeInactive: z.coerce.boolean().default(false),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;