import { createRabbit, EXCHANGE } from "@shop/shared/rabbit";
import { env } from "../config/env.js";

export { EXCHANGE };
export const { connectRabbit, getChannel, consume, closeRabbit } = createRabbit(env.RABBITMQ_URL);
