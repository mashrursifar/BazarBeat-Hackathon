import {
  type AddStockRequest,
  type InventorySummaryItem,
  type PaginationQuery,
  type StockMovementResponse,
  addStockRequestSchema,
  inventorySummaryItemSchema,
  stockMovementResponseSchema,
} from "@bazarbeat/shared";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
type Envelope<T> = { data: T };
type PageEnvelope<T> = { data: T; meta: { page: number; limit: number; total: number } };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(init.method === undefined || init.method === "GET" ? {} : { "X-CSRF-Protection": "1" }),
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(response.status === 401 ? "UNAUTHENTICATED" : "API_ERROR");
  return (await response.json()) as T;
}

export async function getInventory(): Promise<InventorySummaryItem[]> {
  const envelope = await request<Envelope<unknown[]>>("/inventory");
  return envelope.data.map((item) => inventorySummaryItemSchema.parse(item));
}

export async function addStock(input: AddStockRequest): Promise<InventorySummaryItem> {
  const parsed = addStockRequestSchema.parse(input);
  const envelope = await request<Envelope<unknown>>("/inventory/add", { method: "POST", body: JSON.stringify(parsed) });
  return inventorySummaryItemSchema.parse(envelope.data);
}

export async function getMovements(cropId: string, pagination: PaginationQuery): Promise<PageEnvelope<StockMovementResponse[]>> {
  const query = new URLSearchParams({ cropId, page: String(pagination.page), limit: String(pagination.limit) });
  const envelope = await request<PageEnvelope<unknown[]>>(`/inventory/movements?${query}`);
  return { ...envelope, data: envelope.data.map((item) => stockMovementResponseSchema.parse(item)) };
}
