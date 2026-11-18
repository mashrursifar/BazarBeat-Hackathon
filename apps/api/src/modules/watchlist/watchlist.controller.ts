import type { RequestHandler } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import { addWatchlistRequestSchema } from "@bazarbeat/shared";

import { getClock } from "../../shared/clock.js";
import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
} from "./watchlist.service.js";

/**
 * GET /api/v1/watchlist
 * Returns paginated buyer listing cards for the buyer's saved listings.
 */
export const getWatchlistController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  AuthenticatedLocals
> = async (req, res): Promise<void> => {
  const currentUser = res.locals.currentUser;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  const result = await getWatchlist(currentUser.id, { page, limit });
  res.status(200).json(result);
};

/**
 * POST /api/v1/watchlist
 * Saves an ACTIVE listing to the buyer's watchlist.
 * Enforces active status and 50-item cap; idempotent.
 */
export const addToWatchlistController: RequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  AuthenticatedLocals
> = async (req, res): Promise<void> => {
  const currentUser = res.locals.currentUser;
  const body = addWatchlistRequestSchema.parse(req.body);
  const data = await addToWatchlist(currentUser.id, body.listingId);
  const clock = getClock();

  res.status(200).json({
    data,
    meta: {
      serverTime: clock.iso(),
    },
  });
};

/**
 * DELETE /api/v1/watchlist/:listingId
 * Removes a listing from the buyer's watchlist.
 * Idempotent.
 */
export const removeFromWatchlistController: RequestHandler<
  { listingId: string },
  unknown,
  unknown,
  ParsedQs,
  AuthenticatedLocals
> = async (req, res): Promise<void> => {
  const currentUser = res.locals.currentUser;
  const listingId = req.params.listingId;
  const data = await removeFromWatchlist(currentUser.id, listingId);
  const clock = getClock();

  res.status(200).json({
    data,
    meta: {
      serverTime: clock.iso(),
    },
  });
};
