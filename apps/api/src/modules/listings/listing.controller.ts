import type { RequestHandler } from "express";
import {
  AuctionCloseTrigger,
  type CreateListingRequest,
  type FarmerListingListResponse,
  type FarmerListingQuery,
  type FarmerListingResponse,
  type MarketplaceListingListResponse,
  type MarketplaceQuery,
  type RelistListingRequest,
} from "@bazarbeat/shared";

import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import type { QueryValidationLocals } from "../../shared/validate-query.js";
import { getClock } from "../../shared/clock.js";
import { closeAuction } from "../auctions/closing.service.js";
import { getListingStreamHub } from "../realtime/sse-hub.js";
import {
  cancelListing,
  createAndPublishListing,
  getFarmerListings,
  getListingById,
  getMarketplaceListings,
  relistListing,
} from "./listing.service.js";

export const createListingController: RequestHandler<
  Record<string, string>,
  FarmerListingResponse,
  CreateListingRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const result = await createAndPublishListing(response.locals.currentUser, request.body);

  response.status(201).json({
    data: result.listing,
    meta: { serverTime: getClock().iso() },
  });
};

export const getFarmerListingsController: RequestHandler<
  Record<string, string>,
  FarmerListingListResponse,
  unknown,
  unknown,
  AuthenticatedLocals & QueryValidationLocals<FarmerListingQuery>
> = async (_request, response): Promise<void> => {
  const query = response.locals.validatedQuery;
  const result = await getFarmerListings(response.locals.currentUser.id, query);

  response.status(200).json({
    data: result.listings,
    meta: {
      serverTime: getClock().iso(),
      page: query.page,
      limit: query.limit,
      total: result.total,
    },
  });
};

export const getMarketplaceListingsController: RequestHandler<
  Record<string, string>,
  MarketplaceListingListResponse,
  unknown,
  unknown,
  AuthenticatedLocals & QueryValidationLocals<MarketplaceQuery>
> = async (_request, response): Promise<void> => {
  const query = response.locals.validatedQuery;
  const result = await getMarketplaceListings(query);

  response.status(200).json({
    data: result.listings,
    meta: {
      serverTime: getClock().iso(),
      page: query.page,
      limit: query.limit,
      total: result.total,
    },
  });
};

export const getListingByIdController: RequestHandler<
  { id: string },
  FarmerListingResponse,
  unknown,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const listing = await getListingById(request.params.id, response.locals.currentUser);

  response.status(200).json({
    data: listing,
    meta: { serverTime: getClock().iso() },
  });
};

export const acceptCurrentBidController: RequestHandler<
  { id: string },
  unknown,
  unknown,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const result = await closeAuction(request.params.id, {
    trigger: AuctionCloseTrigger.FARMER_ACCEPT,
    farmerId: response.locals.currentUser.id,
  });

  response.status(200).json({
    data: result.order ?? {
      listingId: result.listingId,
      status: result.status,
      closedAt: result.closedAt,
    },
    meta: { serverTime: getClock().iso() },
  });
};

export const cancelListingController: RequestHandler<
  { id: string },
  FarmerListingResponse,
  unknown,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const listing = await cancelListing(request.params.id, response.locals.currentUser);

  response.status(200).json({
    data: listing,
    meta: { serverTime: getClock().iso() },
  });
};

export const relistListingController: RequestHandler<
  { id: string },
  FarmerListingResponse,
  RelistListingRequest,
  unknown,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const result = await relistListing(request.params.id, response.locals.currentUser, request.body);

  response.status(201).json({
    data: result.listing,
    meta: { serverTime: getClock().iso() },
  });
};

export const getListingStreamController: RequestHandler<
  { id: string },
  unknown,
  unknown,
  Record<string, unknown>,
  AuthenticatedLocals
> = async (request, response): Promise<void> => {
  const listingId = request.params.id;
  const currentUser = response.locals.currentUser;

  const listing = await getListingById(listingId, currentUser);

  getListingStreamHub().registerClient({
    listing,
    user: currentUser,
    req: request,
    res: response,
  });
};
