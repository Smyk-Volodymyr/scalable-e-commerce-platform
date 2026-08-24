import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as controller from "./users.controller.js";

export const authRouter = Router();
authRouter.post("/register", controller.register);
authRouter.post("/login", controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);

export const usersRouter = Router();
usersRouter.get("/me", requireAuth, controller.getMe);
usersRouter.patch("/me", requireAuth, controller.updateMe);