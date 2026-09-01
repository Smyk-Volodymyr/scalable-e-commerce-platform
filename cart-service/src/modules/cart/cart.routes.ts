import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./cart.controller.js";

export const cartRouter = Router();

cartRouter.use(requireAuth);

cartRouter.get("/", controller.getCart);
cartRouter.post("/items", controller.addItem);
cartRouter.patch("/items/:productId", controller.setQuantity);
cartRouter.delete("/items/:productId", controller.removeItem);
cartRouter.delete("/", controller.clear);