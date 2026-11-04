import type { FloorPriceEvaluation } from "./schemas/ai-listings.js";

export function evaluateFloorPrice(
  floorPricePerKg: number,
  lowPerKg: number,
  highPerKg: number,
): FloorPriceEvaluation {
  for (const price of [floorPricePerKg, lowPerKg, highPerKg]) {
    if (!Number.isSafeInteger(price) || price < 1) {
      throw new RangeError("Floor and guidance prices must be positive safe integers");
    }
  }
  if (lowPerKg > highPerKg) {
    throw new RangeError("Low guidance price cannot exceed high guidance price");
  }

  if (floorPricePerKg < lowPerKg) return "below-market";
  if (BigInt(floorPricePerKg) * 10n > BigInt(highPerKg) * 13n) return "overpriced";
  return "ok";
}
