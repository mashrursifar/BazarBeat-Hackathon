import { Router } from "express";
import {
  UserRole,
  createListingRequestSchema,
  farmerListingQuerySchema,
  placeBidRequestSchema,
} from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateBody } from "../../shared/validate-body.js";
import { validateQuery } from "../../shared/validate-query.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import { bidsRateLimit } from "../bids/bid.rate-limit.js";
import {
  getListingBidsController,
  placeBidController,
} from "../bids/bid.controller.js";
import {
  createListingController,
  getFarmerListingsController,
  getListingByIdController,
} from "./listing.controller.js";

export const listingsRouter = Router();

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

listingsRouter.get(
  "/:id",
  requireAuthentication,
  getListingByIdController,
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

listingsRouter.get(
  "/:id/bids",
  requireAuthentication,
  getListingBidsController,
);
