import {
  type AnonymizedBidHistoryResponse,
  type BidResponse,
  type BuyerListingDetailResponse,
  type MarketplaceListingListResponse,
  type MarketplaceQuery,
  type PlaceBidRequest,
  anonymizedBidHistoryResponseSchema,
  bidResponseSchema,
  buyerListingDetailResponseSchema,
  marketplaceListingListResponseSchema,
  placeBidRequestSchema,
} from "@bazarbeat/shared";

import { syncServerTime } from "../../../lib/server-clock.js";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

type ErrorEnvelope = { error: { code: string; message: string; details?: unknown } };

export class MarketplaceApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "MarketplaceApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Fetches active marketplace listings with query filters, sorting, and pagination.
 */
export async function getMarketplaceListings(
  query?: Partial<MarketplaceQuery>,
): Promise<MarketplaceListingListResponse> {
  const searchParams = new URLSearchParams();

  if (query) {
    if (query.crop) searchParams.set("crop", query.crop);
    if (query.cropId) searchParams.set("cropId", query.cropId);
    if (query.grade) searchParams.set("grade", query.grade);
    if (query.division) searchParams.set("division", query.division);
    if (query.district) searchParams.set("district", query.district);
    if (typeof query.minPrice === "number") searchParams.set("minPrice", query.minPrice.toString());
    if (typeof query.maxPrice === "number") searchParams.set("maxPrice", query.maxPrice.toString());
    if (typeof query.minQuantity === "number") searchParams.set("minQuantity", query.minQuantity.toString());
    if (typeof query.minQty === "number") searchParams.set("minQty", query.minQty.toString());
    if (typeof query.endingWithin === "number") searchParams.set("endingWithin", query.endingWithin.toString());
    if (query.sort) searchParams.set("sort", query.sort);
    if (typeof query.page === "number") searchParams.set("page", query.page.toString());
    if (typeof query.limit === "number") searchParams.set("limit", query.limit.toString());
    if (query.status) searchParams.set("status", query.status);
  }

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/listings${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let errorCode = "API_ERROR";
    let errorMessage = "Failed to fetch marketplace listings";
    let errorDetails: unknown;

    try {
      const errBody = (await response.json()) as ErrorEnvelope;
      if (errBody?.error?.code) {
        errorCode = errBody.error.code;
        errorMessage = errBody.error.message || errorMessage;
        errorDetails = errBody.error.details;
      }
    } catch {
      if (response.status === 401) errorCode = "UNAUTHENTICATED";
      if (response.status === 403) errorCode = "FORBIDDEN";
      if (response.status === 404) errorCode = "NOT_FOUND";
    }

    throw new MarketplaceApiError(response.status, errorCode, errorMessage, errorDetails);
  }

  const rawJson = (await response.json()) as unknown;
  const parsed = marketplaceListingListResponseSchema.parse(rawJson);

  if (parsed.meta.serverTime) {
    syncServerTime(parsed.meta.serverTime);
  }

  return parsed;
}

/**
 * Fetches buyer-facing listing detail by ID.
 */
export async function getBuyerListingDetail(id: string): Promise<BuyerListingDetailResponse> {
  const url = `${API_BASE_URL}/listings/${id}`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let errorCode = "API_ERROR";
    let errorMessage = "Failed to fetch listing detail";
    let errorDetails: unknown;

    try {
      const errBody = (await response.json()) as ErrorEnvelope;
      if (errBody?.error?.code) {
        errorCode = errBody.error.code;
        errorMessage = errBody.error.message || errorMessage;
        errorDetails = errBody.error.details;
      }
    } catch {
      if (response.status === 401) errorCode = "UNAUTHENTICATED";
      if (response.status === 403) errorCode = "FORBIDDEN";
      if (response.status === 404) errorCode = "NOT_FOUND";
    }

    throw new MarketplaceApiError(response.status, errorCode, errorMessage, errorDetails);
  }

  const rawJson = (await response.json()) as unknown;
  const parsed = buyerListingDetailResponseSchema.parse(rawJson);

  if (parsed.meta?.serverTime) {
    syncServerTime(parsed.meta.serverTime);
  }

  return parsed;
}

/**
 * Fetches anonymized bid history for a listing.
 */
export async function getListingBidsApi(id: string): Promise<AnonymizedBidHistoryResponse> {
  const url = `${API_BASE_URL}/listings/${id}/bids`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let errorCode = "API_ERROR";
    let errorMessage = "Failed to fetch bid history";
    let errorDetails: unknown;

    try {
      const errBody = (await response.json()) as ErrorEnvelope;
      if (errBody?.error?.code) {
        errorCode = errBody.error.code;
        errorMessage = errBody.error.message || errorMessage;
        errorDetails = errBody.error.details;
      }
    } catch {
      if (response.status === 401) errorCode = "UNAUTHENTICATED";
      if (response.status === 403) errorCode = "FORBIDDEN";
      if (response.status === 404) errorCode = "NOT_FOUND";
    }

    throw new MarketplaceApiError(response.status, errorCode, errorMessage, errorDetails);
  }

  const rawJson = (await response.json()) as unknown;
  return anonymizedBidHistoryResponseSchema.parse(rawJson);
}

/**
 * Places a binding bid on an active listing with Idempotency-Key support.
 */
export async function placeBidApi(
  listingId: string,
  amountPerKg: number,
  idempotencyKey?: string,
): Promise<BidResponse> {
  const parsed: PlaceBidRequest = placeBidRequestSchema.parse({ amountPerKg });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-CSRF-Protection": "1",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch(`${API_BASE_URL}/listings/${listingId}/bids`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(parsed),
  });

  if (!response.ok) {
    let errorCode = "API_ERROR";
    let errorMessage = "Failed to place bid";
    let errorDetails: unknown;

    try {
      const errBody = (await response.json()) as ErrorEnvelope;
      if (errBody?.error?.code) {
        errorCode = errBody.error.code;
        errorMessage = errBody.error.message || errorMessage;
        errorDetails = errBody.error.details;
      }
    } catch {
      if (response.status === 401) errorCode = "UNAUTHENTICATED";
      if (response.status === 403) errorCode = "FORBIDDEN";
      if (response.status === 404) errorCode = "NOT_FOUND";
    }

    throw new MarketplaceApiError(response.status, errorCode, errorMessage, errorDetails);
  }

  const rawJson = (await response.json()) as unknown;
  const result = bidResponseSchema.parse(rawJson);

  if (result.meta?.serverTime) {
    syncServerTime(result.meta.serverTime);
  }

  return result;
}
