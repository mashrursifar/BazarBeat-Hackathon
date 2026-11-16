import {
  type FarmerOrderCard,
  type FarmerOrderDetail,
  type OrderListMeta,
  type StockReturnDecision,
} from "@bazarbeat/shared";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

export interface OrdersListResult {
  data: FarmerOrderCard[];
  meta: OrderListMeta;
}

export interface OrderDetailResult {
  data: FarmerOrderDetail;
  meta: { serverTime: string };
}

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
      // Fallback to HTTP status mapping
    }
    throw new Error(errorCode);
  }

  return (await response.json()) as T;
}

export async function fetchOrders(params: {
  status?: string;
  group?: string;
  page?: number;
  limit?: number;
}): Promise<OrdersListResult> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.group) query.set("group", params.group);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const path = query.toString() ? `/orders?${query.toString()}` : "/orders";
  return request<OrdersListResult>(path);
}

export async function fetchOrderDetail(id: string): Promise<OrderDetailResult> {
  return request<OrderDetailResult>(`/orders/${id}`);
}

export async function confirmOrder(
  id: string,
  payload: { handoverAt: string; note?: string },
): Promise<OrderDetailResult> {
  return request<OrderDetailResult>(`/orders/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function markOrderDelivered(
  id: string,
  payload?: { note?: string },
): Promise<OrderDetailResult> {
  return request<OrderDetailResult>(`/orders/${id}/mark-delivered`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function cancelOrder(
  id: string,
  payload: { reason: string; note?: string },
): Promise<OrderDetailResult> {
  return request<OrderDetailResult>(`/orders/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function decideStockReturn(
  id: string,
  payload: { decision: StockReturnDecision | string; note?: string },
): Promise<OrderDetailResult> {
  return request<OrderDetailResult>(`/orders/${id}/stock-return`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
