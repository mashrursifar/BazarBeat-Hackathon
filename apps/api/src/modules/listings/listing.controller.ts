import type { RequestHandler } from "express";
import type { CreateListingRequest, FarmerListingResponse } from "@bazarbeat/shared";

import type { AuthenticatedLocals } from "../auth/auth.middleware.js";
import { createAndPublishListing } from "./listing.service.js";

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
    meta: { serverTime: new Date().toISOString() },
  });
};
