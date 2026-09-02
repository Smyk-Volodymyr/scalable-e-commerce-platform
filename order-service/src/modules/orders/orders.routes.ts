import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./orders.controller.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.post("/checkout", controller.checkout);
ordersRouter.get("/", controller.list);
ordersRouter.get("/:id", controller.getById);
ordersRouter.post("/:id/cancel", controller.cancel);