import path from "node:path";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env, parseTrustProxy } from "./config/env.js";
import { errorMiddleware } from "./shared/error-middleware.js";
import { healthCheckController } from "./modules/health/health.controller.js";
import { configureWebServing } from "./modules/web/web-serving.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { cropsRouter } from "./modules/crops/crop.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { aiRouter } from "./modules/ai/ai.routes.js";
import { listingsRouter } from "./modules/listings/listing.routes.js";
import { bidsRouter } from "./modules/bids/bid.routes.js";
import { configRouter } from "./modules/config/config.routes.js";
import { ordersRouter } from "./modules/orders/order.routes.js";
import { earningsRouter, salesRouter } from "./modules/orders/sales-earnings.routes.js";
import { dashboardsRouter } from "./modules/dashboards/dashboards.routes.js";
import { marketPricesRouter } from "./modules/market-prices/market-prices.routes.js";
import { notificationsRouter } from "./modules/notifications/notification.routes.js";
import { watchlistRouter } from "./modules/watchlist/watchlist.routes.js";

export const app = express();

// 1. Trust proxy configuration (Task 9.1 / ARCHITECTURE §8)
const trustProxyVal = parseTrustProxy(env.TRUST_PROXY);
if (trustProxyVal !== false) {
  app.set("trust proxy", trustProxyVal);
}

// 2. HTTP hardening with helmet & custom CSP matching fonts, styles, and scripts used
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// 3. Compression middleware configured to NOT break or buffer Server-Sent Events / live streams
app.use(
  compression({
    filter: (req, res) => {
      const accept = req.headers.accept;
      if (typeof accept === "string" && accept.includes("text/event-stream")) {
        return false;
      }
      const contentType = res.getHeader("content-type");
      if (typeof contentType === "string" && contentType.includes("text/event-stream")) {
        return false;
      }
      if (req.headers["x-no-compression"]) {
        return false;
      }
      const cacheControl = res.getHeader("cache-control");
      if (typeof cacheControl === "string" && cacheControl.includes("no-transform")) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);

app.use(
  cors({ origin: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()), credentials: true }),
);
app.use(express.json());
app.use(cookieParser());

// Static uploads serving with nosniff and safe headers
app.use(
  "/uploads",
  express.static(path.resolve(env.UPLOAD_DIR), {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

// API v1 feature routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", usersRouter);
app.use("/api/v1/crops", cropsRouter);
app.use("/api/v1/inventory", inventoryRouter);
app.use("/api/v1/ai", aiRouter);
app.use("/api/v1/listings", listingsRouter);
app.use("/api/v1/bids", bidsRouter);
app.use("/api/v1/config", configRouter);
app.use("/api/v1/orders", ordersRouter);
app.use("/api/v1/sales", salesRouter);
app.use("/api/v1/earnings", earningsRouter);
app.use("/api/v1/dashboards", dashboardsRouter);
app.use("/api/v1/market-prices", marketPricesRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/watchlist", watchlistRouter);

// Health check endpoint (Task 9.1: ?deep=true reports DB latency, storage status, AI provider, version)
app.get("/api/v1/health", healthCheckController);

// Strict 404 handler for all unmatched API routes (guarantees API requests never fall through to SPA HTML)
app.use("/api", (_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "API endpoint not found",
    },
  });
});

// Production web application static serving and SPA fallback
configureWebServing(app);

app.use(errorMiddleware);
