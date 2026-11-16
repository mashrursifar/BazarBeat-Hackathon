import {
  type BuyerOrderCard,
  type BuyerOrderDetail,
  type FarmerOrderCard,
  type FarmerOrderDetail,
  type OrderListMeta,
  type PaymentMethod,
  type StockReturnDecision,
} from "@bazarbeat/shared";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

export interface OrdersListResult<T = FarmerOrderCard> {
  data: T[];
  meta: OrderListMeta;
}

export interface OrderDetailResult<T = FarmerOrderDetail> {
  data: T;
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

export async function fetchOrders<T = FarmerOrderCard>(params: {
  status?: string;
  group?: string;
  page?: number;
  limit?: number;
}): Promise<OrdersListResult<T>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.group) query.set("group", params.group);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const path = query.toString() ? `/orders?${query.toString()}` : "/orders";
  return request<OrdersListResult<T>>(path);
}

export async function fetchBuyerOrders(params: {
  status?: string;
  group?: string;
  page?: number;
  limit?: number;
}): Promise<OrdersListResult<BuyerOrderCard>> {
  return fetchOrders<BuyerOrderCard>(params);
}

export async function fetchOrderDetail<T = FarmerOrderDetail>(id: string): Promise<OrderDetailResult<T>> {
  return request<OrderDetailResult<T>>(`/orders/${id}`);
}

export async function confirmOrder(
  id: string,
  payload: { handoverAt: string; note?: string },
): Promise<OrderDetailResult<FarmerOrderDetail>> {
  return request<OrderDetailResult<FarmerOrderDetail>>(`/orders/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function markOrderDelivered(
  id: string,
  payload?: { note?: string },
): Promise<OrderDetailResult<FarmerOrderDetail>> {
  return request<OrderDetailResult<FarmerOrderDetail>>(`/orders/${id}/mark-delivered`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function markOrderPaid(
  id: string,
  payload?: { method?: PaymentMethod | string },
): Promise<OrderDetailResult<BuyerOrderDetail>> {
  return request<OrderDetailResult<BuyerOrderDetail>>(`/orders/${id}/mark-paid`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function completeOrder(
  id: string,
  payload?: { note?: string },
): Promise<OrderDetailResult<BuyerOrderDetail>> {
  return request<OrderDetailResult<BuyerOrderDetail>>(`/orders/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function disputeOrder(
  id: string,
  payload: { reason: string; note?: string },
): Promise<OrderDetailResult<BuyerOrderDetail>> {
  return request<OrderDetailResult<BuyerOrderDetail>>(`/orders/${id}/dispute`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelOrder<T = FarmerOrderDetail | BuyerOrderDetail>(
  id: string,
  payload: { reason: string; note?: string },
): Promise<OrderDetailResult<T>> {
  return request<OrderDetailResult<T>>(`/orders/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function decideStockReturn(
  id: string,
  payload: { decision: StockReturnDecision | string; note?: string },
): Promise<OrderDetailResult<FarmerOrderDetail>> {
  return request<OrderDetailResult<FarmerOrderDetail>>(`/orders/${id}/stock-return`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
