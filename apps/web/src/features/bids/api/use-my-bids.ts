import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { GroupedMyBidsResponse, MyBidsGroupQuery, PaginatedMyBidsResponse } from "@bazarbeat/shared";

import { BidsApiError, getMyBidsByGroup, getMyBidsGrouped } from "./bids-api.js";

export const bidKeys = {
  all: ["bids"] as const,
  mineGrouped: ["bids", "mine", "grouped"] as const,
  mineByGroup: (group: MyBidsGroupQuery, page = 1, limit = 20) =>
    ["bids", "mine", group, { page, limit }] as const,
};

export const BIDS_POLL_INTERVAL_MS = 15_000;

export interface UseMyBidsGroupedOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

/**
 * Hook to fetch buyer's bids grouped by status (active, won, lost), polling every 15 seconds.
 */
export function useMyBidsGrouped(
  options?: UseMyBidsGroupedOptions,
): UseQueryResult<GroupedMyBidsResponse, BidsApiError> {
  return useQuery({
    queryKey: bidKeys.mineGrouped,
    queryFn: () => getMyBidsGrouped(),
    refetchInterval: options?.refetchInterval ?? BIDS_POLL_INTERVAL_MS,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to fetch buyer's bids for a specific tab/group with pagination, polling every 15 seconds.
 */
export function useMyBidsByGroup(
  group: MyBidsGroupQuery,
  page = 1,
  limit = 20,
  options?: UseMyBidsGroupedOptions,
): UseQueryResult<PaginatedMyBidsResponse, BidsApiError> {
  return useQuery({
    queryKey: bidKeys.mineByGroup(group, page, limit),
    queryFn: () => getMyBidsByGroup(group, page, limit),
    refetchInterval: options?.refetchInterval ?? BIDS_POLL_INTERVAL_MS,
    enabled: options?.enabled ?? true,
  });
}
