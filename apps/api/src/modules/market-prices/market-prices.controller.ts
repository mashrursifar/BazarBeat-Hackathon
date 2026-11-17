import type { NextFunction, Request, Response } from "express";
import type {
  MarketPriceQuery,
  MarketSummaryQuery,
  NationalSummaryQuery,
} from "@bazarbeat/shared";

import { marketPriceService } from "./market-price.service.js";

export async function getMarketPricesHistoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as MarketPriceQuery;
    const result = await marketPriceService.getMarketHistory(
      query.cropId,
      query.division,
      query.range,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMarketSummaryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as MarketSummaryQuery;
    const result = await marketPriceService.getMarketSummary(
      query.division,
      query.cropId,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getNationalSummaryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as NationalSummaryQuery;
    const result = await marketPriceService.getNationalSummary(query.cropId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
