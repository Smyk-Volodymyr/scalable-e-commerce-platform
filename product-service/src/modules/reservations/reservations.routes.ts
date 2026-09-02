import { Router } from "express";
import * as controller from "./reservations.controller.js";

export const reservationsRouter = Router();

reservationsRouter.post("/", controller.create);
reservationsRouter.post("/:id/commit", controller.commit);
reservationsRouter.delete("/:id", controller.cancel);
reservationsRouter.post("/:id/release", controller.release);