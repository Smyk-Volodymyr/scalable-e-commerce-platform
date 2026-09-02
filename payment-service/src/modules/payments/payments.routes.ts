import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./payments.controller.js";

export const paymentsRouter = Router();

paymentsRouter.post("/intent", requireAuth, controller.createIntent);
paymentsRouter.get("/order/:orderId", requireAuth, controller.getByOrder);