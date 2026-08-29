import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().toLowerCase().min(1).max(120).regex(slugRegex, "Некоректний slug"),
});

export const updateCategorySchema = createCategorySchema.partial().strict()
  .refine((d) => Object.keys(d).length > 0, { message: "Потрібно передати хоча б одне поле" });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;