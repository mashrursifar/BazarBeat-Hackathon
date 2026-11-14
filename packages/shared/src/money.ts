const POISHA_PER_BDT = 100;
const MAX_BPS = 10_000;

/** Converts a whole BDT amount to integer poisha. */
export function bdtToPoisha(amountInBdt: number): number {
  if (!Number.isSafeInteger(amountInBdt)) {
    throw new RangeError("BDT amount must be a safe integer");
  }
  return amountInBdt * POISHA_PER_BDT;
}

/** Formats integer poisha as a BDT amount for display. */
export function formatPoisha(amountInPoisha: number): string {
  if (!Number.isSafeInteger(amountInPoisha)) {
    throw new RangeError("Poisha amount must be a safe integer");
  }
  return `৳${(amountInPoisha / POISHA_PER_BDT).toFixed(2)}`;
}

/**
 * Calculates lot subtotal in integer poisha from price per kg and quantity in kg.
 * Rounds to whole poisha per CODING_STANDARDS §4.
 */
export function calculateSubtotal(pricePerKgInPoisha: number, quantityKg: number): number {
  if (!Number.isSafeInteger(pricePerKgInPoisha) || pricePerKgInPoisha < 1) {
    throw new RangeError("Price per kg must be a positive safe integer in poisha");
  }
  if (typeof quantityKg !== "number" || !Number.isFinite(quantityKg) || quantityKg <= 0) {
    throw new RangeError("Quantity in kg must be a positive finite number");
  }
  return Math.round(pricePerKgInPoisha * quantityKg);
}

/**
 * Calculates platform fee in integer poisha based on subtotal and basis points (1 bps = 0.01%).
 * AUCTION_RULES §8 & DATA_MODEL (Order): platformFee calculated from PLATFORM_FEE_BPS.
 */
export function calculatePlatformFee(subtotalInPoisha: number, feeBps: number): number {
  if (!Number.isSafeInteger(subtotalInPoisha) || subtotalInPoisha < 0) {
    throw new RangeError("Subtotal must be a non-negative safe integer in poisha");
  }
  if (!Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > MAX_BPS) {
    throw new RangeError(`Fee basis points must be an integer between 0 and ${MAX_BPS}`);
  }
  return Math.round((subtotalInPoisha * feeBps) / MAX_BPS);
}

/**
 * Calculates farmer net earnings (subtotal − platformFee) in integer poisha.
 * AUCTION_RULES §8 & DATA_MODEL (Order): farmerNet = subtotal − fee.
 */
export function calculateFarmerNet(subtotalInPoisha: number, platformFeeInPoisha: number): number {
  if (!Number.isSafeInteger(subtotalInPoisha) || subtotalInPoisha < 0) {
    throw new RangeError("Subtotal must be a non-negative safe integer in poisha");
  }
  if (!Number.isSafeInteger(platformFeeInPoisha) || platformFeeInPoisha < 0) {
    throw new RangeError("Platform fee must be a non-negative safe integer in poisha");
  }
  if (platformFeeInPoisha > subtotalInPoisha) {
    throw new RangeError("Platform fee cannot exceed subtotal");
  }
  return subtotalInPoisha - platformFeeInPoisha;
}

/**
 * Calculates both platform fee and farmer net earnings in integer poisha.
 * Invariant: platformFee + farmerNet === subtotalInPoisha.
 */
export function calculateFeeAndNet(
  subtotalInPoisha: number,
  feeBps: number,
): { platformFee: number; farmerNet: number } {
  const platformFee = calculatePlatformFee(subtotalInPoisha, feeBps);
  const farmerNet = calculateFarmerNet(subtotalInPoisha, platformFee);
  return { platformFee, farmerNet };
}

