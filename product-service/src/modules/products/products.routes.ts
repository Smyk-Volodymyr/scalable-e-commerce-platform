import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import * as controller from "./products.controller.js";

export const productsRouter = Router();

productsRouter.get("/", controller.list);
productsRouter.get("/slug/:slug", controller.getBySlug);
productsRouter.get("/:id", controller.getById);

productsRouter.post("/", requireAuth, requireAdmin, controller.create);
productsRouter.patch("/:id", requireAuth, requireAdmin, controller.update);
productsRouter.delete("/:id", requireAuth, requireAdmin, controller.remove);