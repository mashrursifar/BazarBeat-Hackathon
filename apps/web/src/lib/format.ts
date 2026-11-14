import { formatPoisha } from "@bazarbeat/shared";

const BANGLA_DIGITS: Record<string, string> = {
  "0": "০",
  "1": "১",
  "2": "২",
  "3": "৩",
  "4": "৪",
  "5": "৫",
  "6": "৬",
  "7": "৭",
  "8": "৮",
  "9": "৯",
};

/**
 * Converts Western Arabic digits (0-9) to Eastern Bangla digits (০-৯).
 */
export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (digit) => BANGLA_DIGITS[digit] ?? digit);
}

/**
 * Left-pads a non-negative integer with zeroes up to target length.
 */
export function padZero(value: number, length = 2): string {
  const safeVal = Math.max(0, Math.floor(value));
  return String(safeVal).padStart(length, "0");
}

export interface FormattedDuration {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Digital clock representation, e.g. "01:23:45" or "09:30" */
  digital: string;
}

/**
 * Decomposes a millisecond duration into days, hours, minutes, and seconds,
 * clamped to non-negative values.
 */
export function formatDuration(durationMs: number): FormattedDuration {
  const safeMs = Math.max(0, Math.floor(durationMs));

  const totalSeconds = Math.floor(safeMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  let digital: string;
  if (days > 0) {
    const totalRemainingHours = totalHours;
    digital = `${padZero(totalRemainingHours)}:${padZero(minutes)}:${padZero(seconds)}`;
  } else if (hours > 0) {
    digital = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
  } else {
    digital = `${padZero(minutes)}:${padZero(seconds)}`;
  }

  return {
    totalMs: safeMs,
    days,
    hours,
    minutes,
    seconds,
    digital,
  };
}

/**
 * Formats a currency amount with optional Bangla localization.
 */
export function formatLocalizedPoisha(amountPoisha: number, isBangla = false): string {
  const formatted = formatPoisha(amountPoisha);
  return isBangla ? toBanglaDigits(formatted) : formatted;
}

/**
 * Formats a number with commas and optional Bangla localization.
 */
export function formatLocalizedNumber(value: number, isBangla = false): string {
  const formatted = new Intl.NumberFormat("en-US").format(value);
  return isBangla ? toBanglaDigits(formatted) : formatted;
}
