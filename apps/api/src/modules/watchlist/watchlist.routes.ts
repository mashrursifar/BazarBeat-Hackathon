import { Router } from "express";
import { UserRole, addWatchlistRequestSchema } from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateBody } from "../../shared/validate-body.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import {
  addToWatchlistController,
  getWatchlistController,
  removeFromWatchlistController,
} from "./watchlist.controller.js";

export const watchlistRouter = Router();

watchlistRouter.get(
  "/",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  getWatchlistController,
);

watchlistRouter.post(
  "/",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  requireCsrfProtection,
  validateBody(addWatchlistRequestSchema),
  addToWatchlistController,
);

watchlistRouter.delete(
  "/:listingId",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  requireCsrfProtection,
  removeFromWatchlistController,
);
