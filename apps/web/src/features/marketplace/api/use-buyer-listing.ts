import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  AnonymizedBidHistoryResponse,
  BidResponse,
  BuyerListingDetailResponse,
} from "@bazarbeat/shared";

import { listingKeys } from "../../listings/api/use-listing-wizard-api.js";
import {
  type MarketplaceApiError,
  getBuyerListingDetail,
  getListingBidsApi,
  placeBidApi,
} from "./marketplace-api.js";

/**
 * Fetches buyer-facing listing detail for a single listing.
 */
export function useBuyerListingDetail(
  listingId: string | null | undefined,
): UseQueryResult<BuyerListingDetailResponse, MarketplaceApiError> {
  return useQuery({
    queryKey: listingKeys.detail(listingId ?? null),
    queryFn: () => getBuyerListingDetail(listingId!),
    enabled: Boolean(listingId),
  });
}

/**
 * Fetches anonymized bid history for a listing.
 */
export function useListingBids(
  listingId: string | null | undefined,
): UseQueryResult<AnonymizedBidHistoryResponse, MarketplaceApiError> {
  return useQuery({
    queryKey: listingKeys.bids(listingId ?? null),
    queryFn: () => getListingBidsApi(listingId!),
    enabled: Boolean(listingId),
  });
}

export interface PlaceBidVariables {
  amountPerKg: number;
  idempotencyKey?: string;
}

/**
 * Places a binding bid on a listing without optimistic UI updates.
 * On success, invalidates listing detail and bid history queries.
 */
export function usePlaceBid(
  listingId: string,
): UseMutationResult<BidResponse, MarketplaceApiError, PlaceBidVariables> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ amountPerKg, idempotencyKey }: PlaceBidVariables) =>
      placeBidApi(listingId, amountPerKg, idempotencyKey),
    onSuccess: () => {
      // Refresh detail and bid history from server truth
      void queryClient.invalidateQueries({ queryKey: listingKeys.detail(listingId) });
      void queryClient.invalidateQueries({ queryKey: listingKeys.bids(listingId) });
    },
  });
}
