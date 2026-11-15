import { Router } from "express";
import {
  UserRole,
  compareQuerySchema,
  createListingRequestSchema,
  farmerListingQuerySchema,
  marketplaceQuerySchema,
  placeBidRequestSchema,
  relistListingRequestSchema,
} from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateBody } from "../../shared/validate-body.js";
import { validateQuery } from "../../shared/validate-query.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import { bidsRateLimit } from "../bids/bid.rate-limit.js";
import { getListingBidsController, placeBidController } from "../bids/bid.controller.js";
import {
  acceptCurrentBidController,
  cancelListingController,
  compareListingsController,
  createListingController,
  getFarmerListingsController,
  getListingByIdController,
  getListingStreamController,
  getMarketplaceListingsController,
  relistListingController,
} from "./listing.controller.js";

export const listingsRouter = Router();

listingsRouter.get(
  "/",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  validateQuery(marketplaceQuerySchema),
  getMarketplaceListingsController,
);

listingsRouter.get(
  "/compare",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  validateQuery(compareQuerySchema),
  compareListingsController,
);

listingsRouter.post(
  "/",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  validateBody(createListingRequestSchema),
  createListingController,
);

listingsRouter.get(
  "/mine",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  validateQuery(farmerListingQuerySchema),
  getFarmerListingsController,
);

listingsRouter.get("/:id", requireAuthentication, getListingByIdController);

listingsRouter.get("/:id/stream", requireAuthentication, getListingStreamController);

listingsRouter.post(
  "/:id/accept-current-bid",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  acceptCurrentBidController,
);

listingsRouter.post(
  "/:id/cancel",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  cancelListingController,
);

listingsRouter.post(
  "/:id/relist",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  validateBody(relistListingRequestSchema),
  relistListingController,
);

listingsRouter.post(
  "/:id/bids",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  requireCsrfProtection,
  bidsRateLimit,
  validateBody(placeBidRequestSchema),
  placeBidController,
);

listingsRouter.get("/:id/bids", requireAuthentication, getListingBidsController);
