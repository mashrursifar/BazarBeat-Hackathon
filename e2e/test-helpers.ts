import type { Page } from "@playwright/test";

export interface PlaceBidOptions {
  listingId: string;
  amountPerKg: number;
  isLateBid?: boolean;
  buyerUser?: "buyer-1" | "buyer-2";
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

/**
 * Stable test helper for placing buyer bids through the API.
 * Submits POST /api/v1/listings/:id/bids with custom CSRF protection header,
 * and triggers deterministic real-time SSE stream events in the browser context.
 */
export async function placeBidViaApi(
  page: Page,
  options: PlaceBidOptions,
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ listingId, amountPerKg, isLateBid, buyerUser }) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-CSRF-Protection": "1",
      };
      if (buyerUser) {
        headers["X-Mock-Buyer"] = buyerUser;
      }
      const response = await fetch(`/api/v1/listings/${listingId}/bids`, {
        method: "POST",
        headers,
        body: JSON.stringify({ amountPerKg, isLateBid }),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    options,
  );
}

/**
 * Stable test helper for cancelling a listing through the API.
 * Submits POST /api/v1/listings/:id/cancel with custom CSRF protection header.
 */
export async function cancelListingViaApi(
  page: Page,
  listingId: string,
): Promise<ApiResponse> {
  return await page.evaluate(
    async (id) => {
      const response = await fetch(`/api/v1/listings/${id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    listingId,
  );
}

/**
 * Stable test helper for simulating auction closing in tests.
 * Transitions status to SOLD or EXPIRED_UNSOLD and dispatches real-time SSE event.
 */
export async function closeAuctionViaMock(
  page: Page,
  options: {
    listingId: string;
    status: "SOLD" | "EXPIRED_UNSOLD";
  },
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ listingId, status }) => {
      const response = await fetch(`/api/v1/listings/${listingId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    options,
  );
}

/**
 * Stable test helper for confirming an order via API.
 */
export async function confirmOrderViaApi(
  page: Page,
  orderId: string,
  payload: { handoverAt: string; note?: string },
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ id, body }) => {
      const response = await fetch(`/api/v1/orders/${id}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    { id: orderId, body: payload },
  );
}

/**
 * Stable test helper for paying for an order via API.
 */
export async function payOrderViaApi(
  page: Page,
  orderId: string,
  payload: { method?: string } = {},
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ id, body }) => {
      const response = await fetch(`/api/v1/orders/${id}/mark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    { id: orderId, body: payload },
  );
}

/**
 * Stable test helper for marking an order delivered via API.
 */
export async function markOrderDeliveredViaApi(
  page: Page,
  orderId: string,
  payload: { note?: string } = {},
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ id, body }) => {
      const response = await fetch(`/api/v1/orders/${id}/mark-delivered`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    { id: orderId, body: payload },
  );
}

/**
 * Stable test helper for completing an order via API.
 */
export async function completeOrderViaApi(
  page: Page,
  orderId: string,
  payload: { note?: string } = {},
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ id, body }) => {
      const response = await fetch(`/api/v1/orders/${id}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    { id: orderId, body: payload },
  );
}

/**
 * Stable test helper for cancelling an order via API.
 */
export async function cancelOrderViaApi(
  page: Page,
  orderId: string,
  payload: { reason: string; note?: string },
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ id, body }) => {
      const response = await fetch(`/api/v1/orders/${id}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    { id: orderId, body: payload },
  );
}

/**
 * Stable test helper for deciding stock return on a cancelled order.
 */
export async function decideStockReturnViaApi(
  page: Page,
  orderId: string,
  payload: { decision: string; note?: string },
): Promise<ApiResponse> {
  return await page.evaluate(
    async ({ id, body }) => {
      const response = await fetch(`/api/v1/orders/${id}/stock-return`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    { id: orderId, body: payload },
  );
}

/**
 * Stable test helper for triggering auto-cancel on an expired pending order.
 */
export async function autoCancelOrderViaApi(
  page: Page,
  orderId: string,
): Promise<ApiResponse> {
  return await page.evaluate(
    async (id) => {
      const response = await fetch(`/api/v1/orders/${id}/auto-cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
        },
      });
      const data = await response.json().catch(() => null);
      return { status: response.status, body: data };
    },
    orderId,
  );
}

export {
  DEV_SEED_CREDENTIALS,
  SEED_BUYER_DEFINITIONS,
  SEED_FARMER_DEFINITIONS,
  LISTING_SEED_PLAN,
  seedDevListings,
  verifyFarmerCropLedger,
  type SeedDevListingsOptions,
  type SeedDevListingsResult,
  type UserSeedDefinition,
} from "../apps/api/src/seed/dev-listings.js";

