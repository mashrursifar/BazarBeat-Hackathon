/**
 * Item used to calculate price premium for a completed sale / winning order.
 */
export interface PricePremiumItem {
  quantityKg: number;
  winningPricePerKg: number;
  expectedPricePerKg: number;
}

/**
 * Pure function computing the price premium:
 * Weighted average of winning price versus the AI expected price at listing time,
 * as a percentage with one decimal place.
 *
 * Formula:
 * Total Winning Value = sum(quantityKg * winningPricePerKg)
 * Total Expected Value = sum(quantityKg * expectedPricePerKg)
 * Premium (%) = ((Total Winning Value - Total Expected Value) / Total Expected Value) * 100
 *
 * Example:
 * Total winning: ৳55,000, Total expected: ৳50,000 => ((55000 - 50000) / 50000) * 100 = 10.0%
 *
 * Edge cases:
 * - Empty list returns 0
 * - Non-positive expected value returns 0
 * - Rounds to exactly 1 decimal place (e.g. 5.6)
 */
export function calculatePricePremium(items: readonly PricePremiumItem[]): number {
  if (!items || items.length === 0) {
    return 0;
  }

  let totalWinningValue = 0;
  let totalExpectedValue = 0;
  let validItemCount = 0;

  for (const item of items) {
    if (item.quantityKg <= 0 || item.expectedPricePerKg <= 0 || item.winningPricePerKg < 0) {
      continue;
    }

    totalWinningValue += item.quantityKg * item.winningPricePerKg;
    totalExpectedValue += item.quantityKg * item.expectedPricePerKg;
    validItemCount += 1;
  }

  if (validItemCount === 0 || totalExpectedValue <= 0) {
    return 0;
  }

  const premiumPercent = ((totalWinningValue - totalExpectedValue) / totalExpectedValue) * 100;
  return Math.round(premiumPercent * 10) / 10;
}

/**
 * Convenience helper computing price premium for a single order/listing.
 */
export function calculateSinglePricePremium(
  winningPricePerKg: number,
  expectedPricePerKg: number
): number {
  if (expectedPricePerKg <= 0 || winningPricePerKg < 0) {
    return 0;
  }

  const premiumPercent = ((winningPricePerKg - expectedPricePerKg) / expectedPricePerKg) * 100;
  return Math.round(premiumPercent * 10) / 10;
}
