import {
  type GroupedMyBidsResponse,
  type MyBidsGroupQuery,
  type PaginatedMyBidsResponse,
  groupedMyBidsResponseSchema,
  paginatedMyBidsResponseSchema,
} from "@bazarbeat/shared";

import { syncServerTime } from "../../../lib/server-clock.js";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

type ErrorEnvelope = { error: { code: string; message: string; details?: unknown } };

export class BidsApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "BidsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Fetches buyer's bids grouped by status (active, won, lost) from GET /bids/mine.
 */
export async function getMyBidsGrouped(): Promise<GroupedMyBidsResponse> {
  const url = `${API_BASE_URL}/bids/mine`;
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let errorCode = "API_ERROR";
    let errorMessage = "Failed to fetch buyer bids";
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

    throw new BidsApiError(response.status, errorCode, errorMessage, errorDetails);
  }

  const rawJson = (await response.json()) as unknown;
  const parsed = groupedMyBidsResponseSchema.parse(rawJson);

  if (parsed.meta?.serverTime) {
    syncServerTime(parsed.meta.serverTime);
  }

  return parsed;
}

/**
 * Fetches buyer's bids for a specific group with pagination from GET /bids/mine?group=...
 */
export async function getMyBidsByGroup(
  group: MyBidsGroupQuery,
  page = 1,
  limit = 20,
): Promise<PaginatedMyBidsResponse> {
  const searchParams = new URLSearchParams({
    group,
    page: String(page),
    limit: String(limit),
  });
  const url = `${API_BASE_URL}/bids/mine?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let errorCode = "API_ERROR";
    let errorMessage = "Failed to fetch buyer bids for group";
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

    throw new BidsApiError(response.status, errorCode, errorMessage, errorDetails);
  }

  const rawJson = (await response.json()) as unknown;
  const parsed = paginatedMyBidsResponseSchema.parse(rawJson);

  if (parsed.meta?.serverTime) {
    syncServerTime(parsed.meta.serverTime);
  }

  return parsed;
}
