import type { RequestHandler } from "express";

import type {
  AddStockRequest,
  InventorySummaryItem,
  StockMovementQuery,
  StockMovementResponse,
} from "@bazarbeat/shared";

import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import type { QueryValidationLocals } from "../../shared/validate-query.js";
import {
  addFarmerStock,
  getFarmerInventory,
  getFarmerStockMovements,
} from "./inventory-query.service.js";

export const getInventoryController: RequestHandler<
  Record<string, string>,
  { data: InventorySummaryItem[] },
  unknown,
  unknown,
  AuthenticatedLocals
> = async (_request, response): Promise<void> => {
  const inventory = await getFarmerInventory(response.locals.currentUser.id);
  response.status(200).json({ data: inventory });
};

export const addInventoryController: RequestHandler<
  Record<string, string>,
  { data: InventorySummaryItem },
  AddStockRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const inventory = await addFarmerStock(response.locals.currentUser.id, request.body);
  response.status(201).json({ data: inventory });
};

export const getInventoryMovementsController: RequestHandler<
  Record<string, string>,
  { data: StockMovementResponse[]; meta: { page: number; limit: number; total: number } },
  unknown,
  unknown,
  AuthenticatedLocals & QueryValidationLocals<StockMovementQuery>
> = async (_request, response): Promise<void> => {
  const query = response.locals.validatedQuery;
  const result = await getFarmerStockMovements(response.locals.currentUser.id, query);
  response.status(200).json({
    data: result.items,
    meta: { page: query.page, limit: query.limit, total: result.total },
  });
};
