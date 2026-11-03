import type { StockMovementType } from "@bazarbeat/shared";

export interface InventoryDeltas {
  availableKg: number;
  listedKg: number;
  soldKg: number;
  sourceBucket?: "availableKg" | "listedKg";
}

export function getInventoryDeltas(type: StockMovementType, quantityKg: number): InventoryDeltas {
  switch (type) {
    case "ADD":
    case "ADJUST":
      return { availableKg: quantityKg, listedKg: 0, soldKg: 0 };
    case "LIST":
      return { availableKg: -quantityKg, listedKg: quantityKg, soldKg: 0, sourceBucket: "availableKg" };
    case "RELEASE":
      return { availableKg: quantityKg, listedKg: -quantityKg, soldKg: 0, sourceBucket: "listedKg" };
    case "SELL":
      return { availableKg: 0, listedKg: -quantityKg, soldKg: quantityKg, sourceBucket: "listedKg" };
  }
}
