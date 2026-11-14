import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  AssessmentResult,
  CreateListingRequest,
  CropResponse,
  FarmerListingListResponse,
  FarmerListingQuery,
  FarmerListingResponse,
  PredictPriceRequest,
  PriceGuidance,
  PublicConfig,
} from "@bazarbeat/shared";

import {
  ApiError,
  assessQuality,
  createListing,
  getConfig,
  getCrops,
  getListingById,
  getMyListings,
  predictPrice,
} from "./listing-api.js";

export const listingKeys = {
  crops: ["crops"] as const,
  config: ["public-config"] as const,
  assessment: (cropId: string) => ["ai-assessment", cropId] as const,
  mine: (query?: FarmerListingQuery) => ["listings", "mine", query] as const,
  mineAll: ["listings", "mine"] as const,
  detail: (id: string | null) => ["listings", "detail", id] as const,
};

export function useCrops(): UseQueryResult<CropResponse[], Error> {
  return useQuery({
    queryKey: listingKeys.crops,
    queryFn: getCrops,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePublicConfig(): UseQueryResult<PublicConfig, Error> {
  return useQuery({
    queryKey: listingKeys.config,
    queryFn: getConfig,
    staleTime: 10 * 60 * 1000,
  });
}

export interface AssessQualityInput {
  cropId: string;
  photos: File[];
}

export function useAssessQuality(): UseMutationResult<
  AssessmentResult,
  ApiError,
  AssessQualityInput
> {
  return useMutation({
    mutationFn: ({ cropId, photos }: AssessQualityInput) => assessQuality(cropId, photos),
  });
}

export function usePricePrediction(): UseMutationResult<
  PriceGuidance,
  ApiError,
  PredictPriceRequest
> {
  return useMutation({
    mutationFn: (input: PredictPriceRequest) => predictPrice(input),
  });
}

export function useCreateListing(): UseMutationResult<
  FarmerListingResponse,
  ApiError,
  CreateListingRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListingRequest) => createListing(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listingKeys.mineAll });
    },
  });
}

export function useMyListings(
  query?: FarmerListingQuery,
): UseQueryResult<FarmerListingListResponse, ApiError> {
  return useQuery({
    queryKey: listingKeys.mine(query),
    queryFn: () => getMyListings(query),
  });
}

export function useListingDetail(
  id: string | null,
): UseQueryResult<FarmerListingResponse, ApiError> {
  return useQuery({
    queryKey: listingKeys.detail(id),
    queryFn: () => (id ? getListingById(id) : Promise.reject(new Error("No ID"))),
    enabled: Boolean(id),
  });
}
