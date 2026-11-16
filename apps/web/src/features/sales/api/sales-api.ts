import {
  type SalesQuery,
  type SalesResponse,
  salesResponseSchema,
} from "@bazarbeat/shared";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(init.method === undefined || init.method === "GET"
        ? {}
        : { "X-CSRF-Protection": "1" }),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let errorCode = response.status === 401 ? "UNAUTHENTICATED" : "API_ERROR";
    try {
      const errorJson = (await response.json()) as { error?: { code?: string; message?: string } };
      if (errorJson?.error?.code) {
        errorCode = errorJson.error.code;
      }
    } catch {
      // Fallback
    }
    throw new Error(errorCode);
  }

  return (await response.json()) as T;
}

export async function fetchSales(query: Partial<SalesQuery> = {}): Promise<SalesResponse> {
  const params = new URLSearchParams();
  if (query.cropId) params.set("cropId", query.cropId);
  if (query.crop) params.set("crop", query.crop);
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.buyerDivision) params.set("buyerDivision", query.buyerDivision);
  if (query.division) params.set("division", query.division);
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));

  const path = params.toString() ? `/sales?${params.toString()}` : "/sales";
  const json = await request<unknown>(path);
  return salesResponseSchema.parse(json);
}
