import express from "express";
import { errorHandler, notFoundHandler } from "@shop/shared/http";
import { cartRouter } from "./modules/cart/cart.routes.js";

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "cart-service" });
});

app.use("/cart", cartRouter);

app.use(notFoundHandler);
app.use(errorHandler);
