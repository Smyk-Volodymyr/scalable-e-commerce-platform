import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "./config/env.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  }),
);  

app.use((req, res, next) => {
  const requestId = (req.headers["x-request-id"] as string) ?? crypto.randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      JSON.stringify({
        requestId: req.headers["x-request-id"],
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
      }),
    );
  });
  next();
});

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Забагато запитів, спробуйте пізніше" },
  }),
);

app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    skipSuccessfulRequests: true,
    message: { error: "Забагато спроб входу, спробуйте за 15 хвилин" },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

const commonOptions = {
  changeOrigin: true,
  pathRewrite: { "^/api": "" },
  on: {
    error: (err: Error, _req: unknown, res: unknown) => {
      console.error("Помилка проксіювання:", err.message);
      const response = res as {
        headersSent: boolean;
        status: (c: number) => { json: (b: unknown) => void };
      };
      if (!response.headersSent) {
        response.status(502).json({ error: "Сервіс тимчасово недоступний" });
      }
    },
  },
};

app.use(
  createProxyMiddleware({
    ...commonOptions,
    pathFilter: ["/api/auth/**", "/api/users/**"],
    target: env.USER_SERVICE_URL,
  }),
);

app.use(
  createProxyMiddleware({
    ...commonOptions,
    pathFilter: ["/api/products/**", "/api/categories/**"],
    target: env.PRODUCT_SERVICE_URL,
  }),
);

app.use(
  createProxyMiddleware({
    ...commonOptions,
    pathFilter: ["/api/cart/**"],
    target: env.CART_SERVICE_URL,
  }),
);

app.use(
  createProxyMiddleware({
    ...commonOptions,
    pathFilter: ["/api/orders/**"],
    target: env.ORDER_SERVICE_URL,
  }),
);

app.use(
  createProxyMiddleware({
    ...commonOptions,
    pathFilter: ["/api/payments/**"],
    target: env.PAYMENT_SERVICE_URL,
  }),
);

app.use((req, res) => {
  res.status(404).json({ error: `Роут ${req.method} ${req.path} не існує` });
});

const server = app.listen(env.PORT, () => {
  console.log(`api-gateway працює на http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`${signal} — завершуюсь`);
    server.close(() => {
      console.log("Завершено коректно");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Не встиг завершитись за 10с, вихід примусово");
      process.exit(1);
    }, 10_000).unref();
  });
}