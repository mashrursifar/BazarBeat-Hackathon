import path from "node:path";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";

import { env } from "./config/env.js";
import { errorMiddleware } from "./shared/error-middleware.js";
import { getDatabaseStatus } from "./shared/db.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { cropsRouter } from "./modules/crops/crop.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { aiRouter } from "./modules/ai/ai.routes.js";

export const app = express();
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

app.use("/api/v1/auth", authRouter);
app.use("/api/v1", usersRouter);
app.use("/api/v1/crops", cropsRouter);
app.use("/api/v1/inventory", inventoryRouter);
app.use("/api/v1/ai", aiRouter);

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({ data: { status: "ok", database: getDatabaseStatus() } });
});

app.use(errorMiddleware);
