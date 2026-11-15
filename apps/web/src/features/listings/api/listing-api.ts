import {
  type AnonymizedBidHistoryResponse,
  type AssessmentResult,
  type BidResponse,
  type BuyerListingDetailResponse,
  type CreateListingRequest,
  type CropResponse,
  type FarmerListingListResponse,
  type FarmerListingQuery,
  type FarmerListingResponse,
  type PlaceBidRequest,
  type PredictPriceRequest,
  type PriceGuidance,
  type PublicConfig,
  type RelistListingRequest,
  anonymizedBidHistoryResponseSchema,
  assessmentResultSchema,
  bidResponseSchema,
  buyerListingDetailResponseSchema,
  createListingRequestSchema,
  cropResponseSchema,
  farmerListingListResponseSchema,
  farmerListingResponseSchema,
  placeBidRequestSchema,
  predictPriceRequestSchema,
  priceGuidanceSchema,
  publicConfigResponseSchema,
  relistListingRequestSchema,
} from "@bazarbeat/shared";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

type Envelope<T> = { data: T };
type ErrorEnvelope = { error: { code: string; message: string; details?: unknown } };

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.method && init.method !== "GET" ? { "X-CSRF-Protection": "1" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let errorCode = "API_ERROR";
    let errorMessage = "An error occurred while communicating with the server";
    let errorDetails: unknown;

    try {
      const errBody = (await response.json()) as ErrorEnvelope;
      if (errBody?.error?.code) {
        errorCode = errBody.error.code;
        errorMessage = errBody.error.message || errorMessage;
        errorDetails = errBody.error.details;
      }
    } catch {
      // Fallback to HTTP status text
      if (response.status === 401) errorCode = "UNAUTHENTICATED";
      if (response.status === 403) errorCode = "FORBIDDEN";
      if (response.status === 404) errorCode = "NOT_FOUND";
    }

    throw new ApiError(response.status, errorCode, errorMessage, errorDetails);
  }

  return (await response.json()) as T;
}

/** Fetches active catalog crops */
export async function getCrops(): Promise<CropResponse[]> {
  const envelope = await request<Envelope<unknown[]>>("/crops");
  return envelope.data.map((crop) => cropResponseSchema.parse(crop));
}

/** Sends 1-4 photos for AI quality grading and returns assessment result + signed token */
export async function assessQuality(cropId: string, photos: File[]): Promise<AssessmentResult> {
  const formData = new FormData();
  formData.append("cropId", cropId);
  for (const photo of photos) {
    formData.append("images", photo);
  }

  const envelope = await request<Envelope<unknown>>("/ai/assess-quality", {
    method: "POST",
    body: formData,
  });

  return assessmentResultSchema.parse(envelope.data);
}

/** Predicts price guidance from AI based on crop, grade, and lot size */
export async function predictPrice(input: PredictPriceRequest): Promise<PriceGuidance> {
  const parsed = predictPriceRequestSchema.parse(input);
  const envelope = await request<Envelope<unknown>>("/ai/predict-price", {
    method: "POST",
    body: JSON.stringify(parsed),
    headers: { "Content-Type": "application/json" },
  });
  return priceGuidanceSchema.parse(envelope.data);
}

/** Publishes a new auction listing */
export async function createListing(input: CreateListingRequest): Promise<FarmerListingResponse> {
  const parsed = createListingRequestSchema.parse(input);
  const response = await request<unknown>("/listings", {
    method: "POST",
    body: JSON.stringify(parsed),
    headers: { "Content-Type": "application/json" },
  });
  return farmerListingResponseSchema.parse(response);
}

/** Fetches runtime configuration */
export async function getConfig(): Promise<PublicConfig> {
  const envelope = await request<unknown>("/config");
  const parsed = publicConfigResponseSchema.parse(envelope);
  return parsed.data;
}

/** Fetches farmer's own listings with optional status filter and pagination */
export async function getMyListings(
  query?: FarmerListingQuery,
): Promise<FarmerListingListResponse> {
  const searchParams = new URLSearchParams();
  if (query?.status) searchParams.set("status", query.status);
  if (query?.page) searchParams.set("page", query.page.toString());
  if (query?.limit) searchParams.set("limit", query.limit.toString());

  const queryString = searchParams.toString();
  const path = `/listings/mine${queryString ? `?${queryString}` : ""}`;
  const response = await request<unknown>(path);
  return farmerListingListResponseSchema.parse(response);
}

/** Fetches a single listing's detail by ID (handles both farmer and buyer response shapes) */
export async function getListingById(
  id: string,
): Promise<FarmerListingResponse | BuyerListingDetailResponse> {
  const response = await request<unknown>(`/listings/${id}`);
  if (typeof response === "object" && response !== null && "data" in response) {
    const rawData = (response as { data: unknown }).data;
    if (typeof rawData === "object" && rawData !== null && "reasons" in rawData) {
      return buyerListingDetailResponseSchema.parse(response);
    }
  }
  return farmerListingResponseSchema.parse(response);
}

/** Fetches buyer-facing listing detail by ID */
export async function getBuyerListingDetail(
  id: string,
): Promise<BuyerListingDetailResponse> {
  const response = await request<unknown>(`/listings/${id}`);
  return buyerListingDetailResponseSchema.parse(response);
}

/** Places a binding bid on an active listing with optional Idempotency-Key */
export async function placeBid(
  listingId: string,
  amountPerKg: number,
  idempotencyKey?: string,
): Promise<BidResponse> {
  const parsed: PlaceBidRequest = placeBidRequestSchema.parse({ amountPerKg });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  const response = await request<unknown>(`/listings/${listingId}/bids`, {
    method: "POST",
    body: JSON.stringify(parsed),
    headers,
  });
  return bidResponseSchema.parse(response);
}

/** Cancels an active listing with zero bids */
export async function cancelListing(id: string): Promise<FarmerListingResponse> {
  const response = await request<unknown>(`/listings/${id}/cancel`, {
    method: "POST",
  });
  return farmerListingResponseSchema.parse(response);
}

/** Accepts the current highest bid early and closes the auction */
export async function acceptCurrentBid(id: string): Promise<unknown> {
  return request<unknown>(`/listings/${id}/accept-current-bid`, {
    method: "POST",
  });
}

/** Relists an unsold listing creating a new active auction */
export async function relistListing(
  id: string,
  input: RelistListingRequest,
): Promise<FarmerListingResponse> {
  const parsed = relistListingRequestSchema.parse(input);
  const response = await request<unknown>(`/listings/${id}/relist`, {
    method: "POST",
    body: JSON.stringify(parsed),
    headers: { "Content-Type": "application/json" },
  });
  return farmerListingResponseSchema.parse(response);
}

/** Fetches anonymized bid history for a listing */
export async function getListingBids(id: string): Promise<AnonymizedBidHistoryResponse> {
  const response = await request<unknown>(`/listings/${id}/bids`);
  return anonymizedBidHistoryResponseSchema.parse(response);
}
