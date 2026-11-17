import type { RequestHandler } from "express";
import { type DashboardQuery } from "@bazarbeat/shared";

import { buyerDashboardService } from "./buyer-dashboard.service.js";

export const getBuyerDashboardController: RequestHandler = async (
  request,
  response,
): Promise<void> => {
  const query = (response.locals.validatedQuery ?? request.query) as DashboardQuery;
  const result = await buyerDashboardService.getBuyerDashboard(
    response.locals.currentUser.id,
    query,
  );
  response.status(200).json(result);
};
