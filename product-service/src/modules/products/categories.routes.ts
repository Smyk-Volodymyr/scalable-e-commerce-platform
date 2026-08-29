import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import * as controller from "./categories.controller.js";

export const categoriesRouter = Router();

categoriesRouter.get("/", controller.list);
categoriesRouter.get("/:id", controller.getById);

categoriesRouter.post("/", requireAuth, requireAdmin, controller.create);
categoriesRouter.patch("/:id", requireAuth, requireAdmin, controller.update);
categoriesRouter.delete("/:id", requireAuth, requireAdmin, controller.remove);