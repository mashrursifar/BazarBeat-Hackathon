import { Router } from "express";
import {
  UserRole,
  marketPriceQuerySchema,
  marketSummaryQuerySchema,
  nationalSummaryQuerySchema,
} from "@bazarbeat/shared";

import { validateQuery } from "../../shared/validate-query.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import {
  getMarketPricesHistoryController,
  getMarketSummaryController,
  getNationalSummaryController,
} from "./market-prices.controller.js";

export const marketPricesRouter = Router();

// 1. GET /market-prices/summary?division (Role: Buyer)
marketPricesRouter.get(
  "/summary",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  validateQuery(marketSummaryQuerySchema),
  getMarketSummaryController,
);

// 2. GET /market-prices/national-summary (Role: Buyer)
marketPricesRouter.get(
  "/national-summary",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  validateQuery(nationalSummaryQuerySchema),
  getNationalSummaryController,
);

// 3. GET /market-prices?cropId&division&range (Role: Any authenticated)
marketPricesRouter.get(
  "/",
  requireAuthentication,
  validateQuery(marketPriceQuerySchema),
  getMarketPricesHistoryController,
);
