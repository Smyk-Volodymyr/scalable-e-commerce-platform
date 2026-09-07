import { createPool } from "@shop/shared/db";
import { env } from "../config/env.js";

// Пул створюється тут, бо рядок підключення знає лише цей сервіс. Решта коду
// імпортує pool/query/withTransaction звідси так само, як і раніше.
export const { pool, query, withTransaction } = createPool(env.DATABASE_URL);
