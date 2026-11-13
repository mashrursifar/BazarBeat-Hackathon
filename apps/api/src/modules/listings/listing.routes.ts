import { Router } from "express";
import { UserRole, createListingRequestSchema } from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateBody } from "../../shared/validate-body.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import { createListingController } from "./listing.controller.js";

export const listingsRouter = Router();

listingsRouter.post(
  "/",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  validateBody(createListingRequestSchema),
  createListingController,
);
