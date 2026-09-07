import { createRabbit, EXCHANGE } from "@shop/shared/rabbit";
import { env } from "../config/env.js";

// EXCHANGE реекспортуємо, щоб outbox-публікатор і далі брав його звідси,
// а не знав про пакет напряму.
export { EXCHANGE };
export const { connectRabbit, getChannel, consume, closeRabbit } = createRabbit(env.RABBITMQ_URL);
