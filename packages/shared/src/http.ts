// Точка входу @shop/shared/http: усе, що стосується HTTP-шару express.
// Окремо від /db і /rabbit навмисно — сервіс, якому потрібні лише обробники
// помилок, не має тягнути за собою pg чи amqplib.
export { notFoundHandler, errorHandler } from "./middleware/error.js";
export { createAuth } from "./middleware/auth.js";
export type { JwtPayload } from "./middleware/auth.js";
