import type { JwtPayload } from "../modules/users/users.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};