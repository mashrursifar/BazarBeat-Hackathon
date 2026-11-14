import {
  type AssessmentResult,
  type CreateListingRequest,
  type CropResponse,
  type FarmerListingListResponse,
  type FarmerListingQuery,
  type FarmerListingResponse,
  type PredictPriceRequest,
  type PriceGuidance,
  type PublicConfig,
  assessmentResultSchema,
  createListingRequestSchema,
  cropResponseSchema,
  farmerListingListResponseSchema,
  farmerListingResponseSchema,
  predictPriceRequestSchema,
  priceGuidanceSchema,
  publicConfigResponseSchema,
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

/** Fetches a single listing's detail by ID */
export async function getListingById(id: string): Promise<FarmerListingResponse> {
  const response = await request<unknown>(`/listings/${id}`);
  return farmerListingResponseSchema.parse(response);
}
