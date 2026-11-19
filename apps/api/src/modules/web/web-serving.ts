import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import express from "express";

import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";

export function findWebDistPath(): string | null {
  const candidates: (string | undefined)[] = [
    env.WEB_DIST_PATH,
    path.resolve(process.cwd(), "apps/web/dist"),
    path.resolve(process.cwd(), "../web/dist"),
    path.resolve(process.cwd(), "dist/web"),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(path.join(candidate, "index.html"))) {
      return path.resolve(candidate);
    }
  }

  return null;
}

/**
 * Configures Express to serve the built web application from the same origin with SPA fallback.
 * - API routes (/api/*) and uploads (/uploads/*) remain unaffected.
 * - Hashed assets (/assets/*) are served with long-term immutable caching.
 * - Root index.html and SPA fallback routes are served with no caching.
 */
export function configureWebServing(app: Express, customDistPath?: string): boolean {
  const distPath = customDistPath ?? findWebDistPath();
  const shouldServe = env.SERVE_WEB || env.NODE_ENV === "production" || Boolean(customDistPath);

  if (!shouldServe || !distPath || !fs.existsSync(path.join(distPath, "index.html"))) {
    return false;
  }

  const indexPath = path.join(distPath, "index.html");
  logger.info({ distPath }, "Serving web application with SPA fallback");

  // 1. Long-term immutable caching for hashed bundles and assets
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      immutable: true,
      maxAge: 31536000 * 1000, // 1 year
      index: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    }),
  );

  // 2. Static root assets (favicon, manifest, icon) with moderate caching
  app.use(
    express.static(distPath, {
      index: false,
      maxAge: 3600 * 1000, // 1 hour
    }),
  );

  // 3. SPA fallback for client-side routing on any non-API GET request
  app.use((req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(indexPath);
  });

  return true;
}
