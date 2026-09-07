import { createAuth } from "@shop/shared/http";
import { env } from "../config/env.js";

// Обгортка, а не реекспорт: сама перевірка токена спільна, а секрет приходить
// з локальної схеми оточення — вона свідомо лишається в сервісі.
export const { requireAuth, requireAdmin } = createAuth(env.JWT_SECRET);
export type { JwtPayload } from "@shop/shared/http";
