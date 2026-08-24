import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, "DATABASE_URL обовʼязковий"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  JWT_SECRET: z.string().min(32, "JWT_SECRET має бути щонайменше 32 символи"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Неправильна конфігурація оточення:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;