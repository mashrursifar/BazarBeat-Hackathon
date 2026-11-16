import { Router } from "express";
import { UserRole, salesQuerySchema } from "@bazarbeat/shared";

import { validateQuery } from "../../shared/validate-query.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import { getEarningsController, getSalesController } from "./sales-earnings.controller.js";

export const salesRouter = Router();
salesRouter.get(
  "/",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  validateQuery(salesQuerySchema),
  getSalesController,
);

export const earningsRouter = Router();
earningsRouter.get(
  "/",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  getEarningsController,
);
