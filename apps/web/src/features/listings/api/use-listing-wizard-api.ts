import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import type {
  AssessmentResult,
  CreateListingRequest,
  CropResponse,
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
  predictPrice,
} from "./listing-api.js";

export const listingKeys = {
  crops: ["crops"] as const,
  config: ["public-config"] as const,
  assessment: (cropId: string) => ["ai-assessment", cropId] as const,
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
  return useMutation({
    mutationFn: (input: CreateListingRequest) => createListing(input),
  });
}
