import type { RequestHandler } from "express";
import { type SalesQuery } from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import { getSalesEarningsService } from "./sales-earnings.service.js";

export const getSalesController: RequestHandler = async (request, response): Promise<void> => {
  const service = getSalesEarningsService();
  const query = (response.locals.validatedQuery ?? request.query) as SalesQuery;
  const result = await service.getSales(response.locals.currentUser.id, query);
  response.status(200).json(result);
};

export const getEarningsController: RequestHandler = async (_request, response): Promise<void> => {
  const clock = getClock();
  const service = getSalesEarningsService();
  const data = await service.getEarnings(response.locals.currentUser.id);
  response.status(200).json({
    data,
    meta: {
      serverTime: clock.iso(),
    },
  });
};
