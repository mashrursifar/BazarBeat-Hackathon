const POISHA_PER_BDT = 100;

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
