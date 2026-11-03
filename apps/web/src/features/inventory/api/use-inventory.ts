import { type UseMutationResult, type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddStockRequest, PaginationQuery } from "@bazarbeat/shared";
import type { InventorySummaryItem } from "@bazarbeat/shared";

import * as api from "./inventory-api.js";

export const inventoryKeys = {
  all: ["inventory"] as const,
  movements: (cropId: string, page: number) => ["inventory", "movements", cropId, page] as const,
};

export function useInventory(): UseQueryResult<InventorySummaryItem[], Error> {
  return useQuery({ queryKey: inventoryKeys.all, queryFn: api.getInventory });
}

export function useAddStock(): UseMutationResult<InventorySummaryItem, Error, AddStockRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddStockRequest) => api.addStock(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["inventory", "movements"] });
    },
  });
}

export function useInventoryMovements(cropId: string, pagination: PaginationQuery): UseQueryResult<Awaited<ReturnType<typeof api.getMovements>>, Error> {
  return useQuery({
    queryKey: inventoryKeys.movements(cropId, pagination.page),
    queryFn: () => api.getMovements(cropId, pagination),
    enabled: cropId !== "",
  });
}
