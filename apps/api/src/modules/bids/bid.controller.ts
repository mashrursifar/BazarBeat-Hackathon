import type { RequestHandler } from "express";
import type {
  AnonymizedBidHistoryResponse,
  BidResponse,
  PlaceBidRequest,
} from "@bazarbeat/shared";

import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import { getClock } from "../../shared/clock.js";
import { getListingBids, placeBid } from "./bid.service.js";

export const placeBidController: RequestHandler<
  { id: string },
  BidResponse,
  PlaceBidRequest,
  unknown,
  AuthenticatedLocals
> = async (req, res): Promise<void> => {
  const clock = getClock();
  const idempotencyHeader = req.headers["idempotency-key"];
  const idempotencyKey = typeof idempotencyHeader === "string" ? idempotencyHeader : undefined;

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
