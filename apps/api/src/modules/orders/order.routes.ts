import { Router } from "express";
import {
  UserRole,
  cancelOrderRequestSchema,
  completeOrderRequestSchema,
  confirmOrderRequestSchema,
  decideStockReturnRequestSchema,
  disputeOrderRequestSchema,
  markDeliveredRequestSchema,
  markPaidRequestSchema,
  orderListQuerySchema,
} from "@bazarbeat/shared";

import { requireCsrfProtection } from "../../shared/csrf-middleware.js";
import { validateBody } from "../../shared/validate-body.js";
import { validateQuery } from "../../shared/validate-query.js";
import { requireAuthentication, requireRole } from "../auth/auth.middleware.js";
import {
  cancelOrderController,
  completeOrderController,
  confirmOrderController,
  decideStockReturnController,
  disputeOrderController,
  getOrderByIdController,
  listOrdersController,
  markOrderDeliveredController,
  markOrderPaidController,
} from "./order.controller.js";

export const ordersRouter = Router();

ordersRouter.get(
  "/",
  requireAuthentication,
  validateQuery(orderListQuerySchema),
  listOrdersController,
);

ordersRouter.post(
  "/:id/confirm",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  validateBody(confirmOrderRequestSchema),
  confirmOrderController,
);

ordersRouter.post(
  "/:id/mark-paid",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  requireCsrfProtection,
  validateBody(markPaidRequestSchema),
  markOrderPaidController,
);

ordersRouter.post(
  "/:id/mark-delivered",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  validateBody(markDeliveredRequestSchema),
  markOrderDeliveredController,
);

ordersRouter.post(
  "/:id/complete",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  requireCsrfProtection,
  validateBody(completeOrderRequestSchema),
  completeOrderController,
);

ordersRouter.post(
  "/:id/dispute",
  requireAuthentication,
  requireRole(UserRole.BUYER),
  requireCsrfProtection,
  validateBody(disputeOrderRequestSchema),
  disputeOrderController,
);

ordersRouter.post(
  "/:id/cancel",
  requireAuthentication,
  requireCsrfProtection,
  validateBody(cancelOrderRequestSchema),
  cancelOrderController,
);

ordersRouter.post(
  "/:id/stock-return",
  requireAuthentication,
  requireRole(UserRole.FARMER),
  requireCsrfProtection,
  validateBody(decideStockReturnRequestSchema),
  decideStockReturnController,
);

ordersRouter.get(
  "/:id",
  requireAuthentication,
  getOrderByIdController,
);
