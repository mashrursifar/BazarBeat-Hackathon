import { Router } from "express";
import { UserRole, createListingRequestSchema, farmerListingQuerySchema } from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateBody } from "../../shared/validate-body.js";
import { validateQuery } from "../../shared/validate-query.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
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
