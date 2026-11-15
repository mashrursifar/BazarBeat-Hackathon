import type { RequestHandler } from "express";
import type {
  AnonymizedBidHistoryResponse,
  BidResponse,
  MyBidsQuery,
  MyBidsResponse,
  PlaceBidRequest,
} from "@bazarbeat/shared";

import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import type { QueryValidationLocals } from "../../shared/validate-query.js";
import { getClock } from "../../shared/clock.js";
import { getListingBids, getMyBids, placeBid } from "./bid.service.js";

export const placeBidController: RequestHandler<
  { id: string },
  BidResponse,
  PlaceBidRequest,
  unknown,
  AuthenticatedLocals
> = async (req, res): Promise<void> => {
  const clock = getClock();
  const idempotencyHeader = req.headers["idempotency-key"];
  const idempotencyKey =
    typeof idempotencyHeader === "string"
      ? idempotencyHeader
      : Array.isArray(idempotencyHeader)
        ? idempotencyHeader[0]
        : undefined;

  const result = await placeBid(res.locals.currentUser, req.params.id, {
    amountPerKg: req.body.amountPerKg,
    idempotencyKey,
  });

  res.status(201).json({
    data: result.bid,
    meta: {
      serverTime: clock.iso(),
    },
  });
};

export const getListingBidsController: RequestHandler<
  { id: string },
  AnonymizedBidHistoryResponse,
  unknown,
  unknown,
  Partial<AuthenticatedLocals>
> = async (req, res): Promise<void> => {
  const clock = getClock();
  const bids = await getListingBids(req.params.id, res.locals.currentUser);

  res.status(200).json({
    data: bids,
    meta: {
      serverTime: clock.iso(),
    },
  });
};

export const getMyBidsController: RequestHandler<
  unknown,
  MyBidsResponse,
  unknown,
  unknown,
  AuthenticatedLocals & QueryValidationLocals<MyBidsQuery>
> = async (_req, res): Promise<void> => {
  const result = await getMyBids(res.locals.currentUser, res.locals.validatedQuery);
  res.status(200).json(result);
};
