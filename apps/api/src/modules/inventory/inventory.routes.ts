import { Router } from "express";

import {
  UserRole,
  addStockRequestSchema,
  emptyQuerySchema,
  stockMovementQuerySchema,
} from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateQuery } from "../../shared/validate-query.js";
import { validateBody } from "../../shared/validate-body.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import {
  addInventoryController,
  getInventoryController,
  getInventoryMovementsController,
} from "./inventory.controller.js";

export const inventoryRouter = Router();

inventoryRouter.get(
  "/",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  validateQuery(emptyQuerySchema),
  getInventoryController,
);
inventoryRouter.post(
  "/add",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  validateQuery(emptyQuerySchema),
  validateBody(addStockRequestSchema),
  addInventoryController,
);
inventoryRouter.get(
  "/movements",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  validateQuery(stockMovementQuerySchema),
  getInventoryMovementsController,
);
