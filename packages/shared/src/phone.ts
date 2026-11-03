const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Normalize a Bangladeshi mobile number to the canonical +8801XXXXXXXXX form. */
export function normalizeBangladeshPhone(phone: string): string {
  const asciiDigits = Array.from(phone, (character) => {
    const digit = BANGLA_DIGITS.indexOf(character);
    return digit < 0 ? character : String(digit);
  }).join("");
  const compact = asciiDigits.replace(/[\s()-]/g, "");
  const national = compact.startsWith("+880")
    ? `0${compact.slice(4)}`
    : compact.startsWith("880")
      ? `0${compact.slice(3)}`
      : compact;
  if (!/^01[3-9]\d{8}$/.test(national)) {
    throw new RangeError("Phone must be a valid Bangladesh mobile number");
  }
  return `+880${national.slice(1)}`;
}
