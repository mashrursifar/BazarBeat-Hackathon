import type { RequestHandler } from "express";
import { type DashboardQuery } from "@bazarbeat/shared";

import { farmerDashboardService } from "./farmer-dashboard.service.js";

export const getFarmerDashboardController: RequestHandler = async (
  request,
  response,
): Promise<void> => {
  const query = (response.locals.validatedQuery ?? request.query) as DashboardQuery;
  const result = await farmerDashboardService.getFarmerDashboard(
    response.locals.currentUser.id,
    query,
  );
  response.status(200).json(result);
};
