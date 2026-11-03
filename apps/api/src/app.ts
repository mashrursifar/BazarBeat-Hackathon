import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorMiddleware } from "./shared/error-middleware.js";
import { getDatabaseStatus } from "./shared/db.js";

export const app = express();
app.use(cors({ origin: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()), credentials: true }));
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({ data: { status: "ok", database: getDatabaseStatus() } });
});

app.use(errorMiddleware);
