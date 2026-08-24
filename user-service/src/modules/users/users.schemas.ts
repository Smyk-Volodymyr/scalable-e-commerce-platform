import { z } from "zod";

export const registerSchema = z.object({
  email: z.email("Некоректний email").trim().toLowerCase(),
  password: z.string().min(8, "Пароль має бути щонайменше 8 символів").max(72),
  fullName: z.string().trim().min(1).max(120).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1, "Пароль обовʼязковий"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const updateMeSchema = z
  .object({
    email: z.email("Некоректний email").trim().toLowerCase().optional(),
    fullName: z.string().trim().min(1).max(120).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Потрібно передати хоча б одне поле",
  });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});