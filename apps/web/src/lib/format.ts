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

const MONTH_NAMES_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTH_NAMES_BN = [
  "জানু",
  "ফেব্রু",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টে",
  "অক্টো",
  "নভে",
  "ডিসে",
];

/**
 * Formats a dashboard date bucket string (YYYY-MM-DD or YYYY-MM) in Asia/Dhaka time
 * with optional Bangla localization.
 */
export function formatBucketDate(bucket: string, isBangla = false): string {
  if (!bucket) return "";

  // Handle YYYY-MM-DD (e.g. 2026-11-10)
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bucket);
  if (ymdMatch) {
    const monthStr = ymdMatch[2];
    const dayStr = ymdMatch[3];
    if (monthStr && dayStr) {
      const monthIdx = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      const monthName = isBangla
        ? (MONTH_NAMES_BN[monthIdx] ?? monthStr)
        : (MONTH_NAMES_EN[monthIdx] ?? monthStr);
      const dayFormatted = isBangla ? toBanglaDigits(day) : String(day);
      return `${dayFormatted} ${monthName}`;
    }
  }

  // Handle YYYY-MM (e.g. 2026-11)
  const ymMatch = /^(\d{4})-(\d{2})$/.exec(bucket);
  if (ymMatch) {
    const yearStr = ymMatch[1];
    const monthStr = ymMatch[2];
    if (yearStr && monthStr) {
      const monthIdx = parseInt(monthStr, 10) - 1;
      const shortYear = yearStr.slice(-2);
      const monthName = isBangla
        ? (MONTH_NAMES_BN[monthIdx] ?? monthStr)
        : (MONTH_NAMES_EN[monthIdx] ?? monthStr);
      const yearFormatted = isBangla ? toBanglaDigits(shortYear) : shortYear;
      return `${monthName} '${yearFormatted}`;
    }
  }

  // Handle ISO string
  if (bucket.includes("T")) {
    try {
      const d = new Date(bucket);
      // Asia/Dhaka is UTC+6
      const dhakaTime = new Date(d.getTime() + 6 * 60 * 60 * 1000);
      const day = dhakaTime.getUTCDate();
      const monthIdx = dhakaTime.getUTCMonth();
      const monthName = isBangla ? MONTH_NAMES_BN[monthIdx] : MONTH_NAMES_EN[monthIdx];
      const dayFormatted = isBangla ? toBanglaDigits(day) : String(day);
      return `${dayFormatted} ${monthName}`;
    } catch {
      return bucket;
    }
  }

  return bucket;
}

/**
 * Formats poisha into a compact Taka display for chart axis ticks, e.g. ৳25k or ৳500.
 */
export function formatCompactPoisha(amountPoisha: number, isBangla = false): string {
  const taka = Math.floor(amountPoisha / 100);
  if (taka >= 100_000) {
    const val = (taka / 1000).toFixed(0);
    const str = `৳${val}k`;
    return isBangla ? toBanglaDigits(str) : str;
  }
  if (taka >= 10_000) {
    const val = (taka / 1000).toFixed(0);
    const str = `৳${val}k`;
    return isBangla ? toBanglaDigits(str) : str;
  }
  const str = `৳${taka}`;
  return isBangla ? toBanglaDigits(str) : str;
}
