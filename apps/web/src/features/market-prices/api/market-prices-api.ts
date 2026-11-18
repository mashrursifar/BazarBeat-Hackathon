import {
  type MarketHistoryResponse,
  type MarketPriceQuery,
  type MarketSummaryQuery,
  type MarketSummaryResponse,
  type NationalSummaryQuery,
  type NationalSummaryResponse,
  marketHistoryResponseSchema,
  marketSummaryResponseSchema,
  nationalSummaryResponseSchema,
} from "@bazarbeat/shared";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

export async function fetchMarketHistory(
  query: MarketPriceQuery,
): Promise<MarketHistoryResponse> {
  const params = new URLSearchParams();
  params.set("cropId", query.cropId);
  if (query.division) params.set("division", query.division);
  if (query.range) params.set("range", query.range);

  const url = `${API_BASE_URL}/market-prices?${params.toString()}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let errorCode = response.status === 401 ? "UNAUTHENTICATED" : "API_ERROR";
    try {
      const errJson = (await response.json()) as { error?: { code?: string; message?: string } };
      if (errJson?.error?.code) {
        errorCode = errJson.error.code;
      }
    } catch {
      // ignore
    }
    throw new Error(errorCode);
  }

  const json = await response.json();
  return marketHistoryResponseSchema.parse(json);
}

export async function fetchMarketSummary(
  query: Partial<MarketSummaryQuery> = {},
): Promise<MarketSummaryResponse> {
  const params = new URLSearchParams();
  if (query.cropId) params.set("cropId", query.cropId);
  if (query.division) params.set("division", query.division);

  const url = `${API_BASE_URL}/market-prices/summary${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let errorCode = response.status === 401 ? "UNAUTHENTICATED" : "API_ERROR";
    try {
      const errJson = (await response.json()) as { error?: { code?: string; message?: string } };
      if (errJson?.error?.code) {
        errorCode = errJson.error.code;
      }
    } catch {
      // ignore
    }
    throw new Error(errorCode);
  }

  const json = await response.json();
  return marketSummaryResponseSchema.parse(json);
}

export async function fetchNationalSummary(
  query: Partial<NationalSummaryQuery> = {},
): Promise<NationalSummaryResponse> {
  const params = new URLSearchParams();
  if (query.cropId) params.set("cropId", query.cropId);

  const url = `${API_BASE_URL}/market-prices/national-summary${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let errorCode = response.status === 401 ? "UNAUTHENTICATED" : "API_ERROR";
    try {
      const errJson = (await response.json()) as { error?: { code?: string; message?: string } };
      if (errJson?.error?.code) {
        errorCode = errJson.error.code;
      }
    } catch {
      // ignore
    }
    throw new Error(errorCode);
  }

  const json = await response.json();
  return nationalSummaryResponseSchema.parse(json);
}
