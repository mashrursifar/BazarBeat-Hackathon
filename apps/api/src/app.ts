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

export const app = express();
app.use(cors({ origin: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()), credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1", usersRouter);
app.use("/api/v1/crops", cropsRouter);
app.use("/api/v1/inventory", inventoryRouter);

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({ data: { status: "ok", database: getDatabaseStatus() } });
});

app.use(errorMiddleware);
