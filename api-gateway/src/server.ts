import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "./config/env.js";

const app = express();

// ЖОДНОГО express.json() тут немає, і це навмисно. Пояснення нижче.

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

// Спільні налаштування для всіх проксі.
const commonOptions = {
  changeOrigin: true,
  // Прибираємо префікс /api: назовні /api/products, всередину — /products.
  // Сервіси нічого не знають про існування gateway.
  pathRewrite: { "^/api": "" },
  on: {
    error: (err: Error, _req: unknown, res: unknown) => {
      // Сервіс лежить або не відповідає. 502 Bad Gateway — саме той код:
      // "я живий, але той, до кого я звертався, — ні".
      console.error("Помилка проксіювання:", err.message);
      const response = res as { headersSent: boolean; status: (c: number) => { json: (b: unknown) => void } };
      if (!response.headersSent) {
        response.status(502).json({ error: "Сервіс тимчасово недоступний" });
      }
    },
  },
};

// pathFilter, а не app.use("/api/auth", ...) — щоб проксі бачив ПОВНИЙ шлях.
// При монтуванні на префікс Express обрізає його з req.url, і pathRewrite
// не мав би що переписувати.
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

app.use((req, res) => {
  res.status(404).json({ error: `Роут ${req.method} ${req.path} не існує` });
});

app.listen(env.PORT, () => {
  console.log(`api-gateway працює на http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});