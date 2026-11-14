import type { RequestHandler } from "express";
import type {
  CreateListingRequest,
  FarmerListingListResponse,
  FarmerListingQuery,
  FarmerListingResponse,
} from "@bazarbeat/shared";

import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import type { QueryValidationLocals } from "../../shared/validate-query.js";
import { getClock } from "../../shared/clock.js";
import {
  createAndPublishListing,
  getFarmerListings,
  getListingById,
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
