import { Router } from "express";
import { UserRole, dashboardQuerySchema } from "@bazarbeat/shared";

import { validateQuery } from "../../shared/validate-query.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import { getFarmerDashboardController } from "./farmer-dashboard.controller.js";

export const dashboardsRouter = Router();

dashboardsRouter.get(
  "/farmer",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  validateQuery(dashboardQuerySchema),
  getFarmerDashboardController,
);
