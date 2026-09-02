import { Router } from "express";
import * as controller from "./orders.controller.js";

export const ordersInternalRouter = Router();
ordersInternalRouter.post("/:id/paid", controller.markPaid);