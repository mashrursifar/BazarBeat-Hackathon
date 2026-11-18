import {
  type DashboardQuery,
  type FarmerDashboardResponse,
  farmerDashboardResponseSchema,
} from "@bazarbeat/shared";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

export async function fetchFarmerDashboard(
  query: Partial<DashboardQuery> = {},
): Promise<FarmerDashboardResponse> {
  const params = new URLSearchParams();
  if (query.range) params.set("range", query.range);

  const url = `${API_BASE_URL}/dashboards/farmer${params.toString() ? `?${params.toString()}` : ""}`;
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
      // Fallback to generic status
    }
    throw new Error(errorCode);
  }

  const json = await response.json();
  return farmerDashboardResponseSchema.parse(json);
}
