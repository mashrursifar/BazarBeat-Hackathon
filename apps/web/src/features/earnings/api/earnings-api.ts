import {
  type EarningsData,
  earningsResponseSchema,
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

export async function fetchEarnings(): Promise<EarningsData> {
  const json = await request<unknown>("/earnings");
  const parsed = earningsResponseSchema.parse(json);
  return parsed.data;
}
