import {
  type BucketGranularity,
  DASHBOARD_BUCKET_RULES,
  type DashboardRangePreset,
} from "./schemas/dashboards.js";

/**
 * Asia/Dhaka is permanently UTC+6 with no Daylight Saving Time.
 */
export const ASIA_DHAKA_OFFSET_HOURS = 6;
export const ASIA_DHAKA_OFFSET_MS = ASIA_DHAKA_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Converts any Date, ISO string, or epoch timestamp to a Date shifted
 * into the Asia/Dhaka civil representation (using UTC get* methods).
 */
export function toAsiaDhakaCivilDate(date: Date | string | number): Date {
  const raw = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(raw.getTime())) {
    throw new RangeError(`Invalid date passed: ${String(date)}`);
  }
  return new Date(raw.getTime() + ASIA_DHAKA_OFFSET_MS);
}

/**
 * Returns a calendar bucket key for an instant in time in the Asia/Dhaka timezone.
 *
 * Granularities:
 * - "day": "YYYY-MM-DD"
 * - "month": "YYYY-MM"
 * - "week": "YYYY-[W]WW" (ISO week in Asia/Dhaka)
 *
 * Critical boundary behavior:
 * - 2026-11-09T18:00:00.000Z is 2026-11-10 00:00:00 in Asia/Dhaka => "2026-11-10"
 * - 2026-11-09T17:59:59.999Z is 2026-11-09 23:59:59.999 in Asia/Dhaka => "2026-11-09"
 */
export function getAsiaDhakaBucketKey(
  date: Date | string | number,
  granularity: BucketGranularity = "day",
): string {
  const dhaka = toAsiaDhakaCivilDate(date);
  const year = dhaka.getUTCFullYear();
  const month = String(dhaka.getUTCMonth() + 1).padStart(2, "0");

  if (granularity === "month") {
    return `${year}-${month}`;
  }

  const day = String(dhaka.getUTCDate()).padStart(2, "0");
  if (granularity === "day") {
    return `${year}-${month}-${day}`;
  }

  // Week granularity: ISO week based on Asia/Dhaka civil date
  const target = new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export const asiaDhakaBucketKey = getAsiaDhakaBucketKey;

/**
 * Generates an ordered chronological list of Asia/Dhaka bucket keys
 * between startDate and endDate (inclusive).
 */
export function generateAsiaDhakaBucketKeys(
  startDate: Date | string | number,
  endDate: Date | string | number,
  granularity: BucketGranularity = "day",
): string[] {
  const startCivil = toAsiaDhakaCivilDate(startDate);
  const endCivil = toAsiaDhakaCivilDate(endDate);

  if (startCivil.getTime() > endCivil.getTime()) {
    return [];
  }

  const keys: string[] = [];

  if (granularity === "day") {
    // Walk day by day in UTC representing Asia/Dhaka civil days
    const current = new Date(
      Date.UTC(startCivil.getUTCFullYear(), startCivil.getUTCMonth(), startCivil.getUTCDate()),
    );
    const end = new Date(
      Date.UTC(endCivil.getUTCFullYear(), endCivil.getUTCMonth(), endCivil.getUTCDate()),
    );

    while (current.getTime() <= end.getTime()) {
      const year = current.getUTCFullYear();
      const month = String(current.getUTCMonth() + 1).padStart(2, "0");
      const day = String(current.getUTCDate()).padStart(2, "0");
      keys.push(`${year}-${month}-${day}`);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return keys;
  }

  if (granularity === "month") {
    const curYear = startCivil.getUTCFullYear();
    const curMonth = startCivil.getUTCMonth();
    const endYear = endCivil.getUTCFullYear();
    const endMonth = endCivil.getUTCMonth();

    let y = curYear;
    let m = curMonth;

    while (y < endYear || (y === endYear && m <= endMonth)) {
      keys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return keys;
  }

  // Week
  const current = new Date(startCivil.getTime());
  const seen = new Set<string>();

  while (current.getTime() <= endCivil.getTime()) {
    const k = getAsiaDhakaBucketKey(current, "week");
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
    current.setUTCDate(current.getUTCDate() + 7);
  }
  const lastKey = getAsiaDhakaBucketKey(endCivil, "week");
  if (!seen.has(lastKey)) {
    keys.push(lastKey);
  }
  return keys;
}

export const asiaDhakaBucketKeys = generateAsiaDhakaBucketKeys;

/**
 * Computes window boundaries and bucket keys for a given dashboard range preset
 * relative to referenceDate (in Asia/Dhaka time).
 */
export function getRangeBucketKeys(
  preset: DashboardRangePreset,
  referenceDate: Date | string | number = new Date(),
): {
  preset: DashboardRangePreset;
  granularity: BucketGranularity;
  currentWindow: { start: Date; end: Date };
  previousWindow: { start: Date; end: Date } | null;
  currentKeys: string[];
  previousKeys: string[];
} {
  const refDhaka = toAsiaDhakaCivilDate(referenceDate);
  const rule = DASHBOARD_BUCKET_RULES[preset];

  // End of current window is the end of the civil day in Asia/Dhaka
  const endCivil = new Date(
    Date.UTC(refDhaka.getUTCFullYear(), refDhaka.getUTCMonth(), refDhaka.getUTCDate(), 23, 59, 59, 999),
  );
  // Convert back to real UTC Date
  const currentEnd = new Date(endCivil.getTime() - ASIA_DHAKA_OFFSET_MS);

  if (preset === "all") {
    // Default to last 12 months for 'all' series presentation
    const startCivil = new Date(Date.UTC(refDhaka.getUTCFullYear() - 1, refDhaka.getUTCMonth() + 1, 1));
    const currentStart = new Date(startCivil.getTime() - ASIA_DHAKA_OFFSET_MS);
    const currentKeys = generateAsiaDhakaBucketKeys(currentStart, currentEnd, rule.granularity);
    return {
      preset,
      granularity: rule.granularity,
      currentWindow: { start: currentStart, end: currentEnd },
      previousWindow: null,
      currentKeys,
      previousKeys: [],
    };
  }

  if (rule.granularity === "month") {
    // e.g. '1y': 12 full calendar months ending with current month
    const curYear = refDhaka.getUTCFullYear();
    const curMonth = refDhaka.getUTCMonth(); // 0..11
    const startCivil = new Date(Date.UTC(curYear - 1, curMonth + 1, 1));
    const currentStart = new Date(startCivil.getTime() - ASIA_DHAKA_OFFSET_MS);

    const prevStartCivil = new Date(Date.UTC(curYear - 2, curMonth + 1, 1));
    const prevEndCivil = new Date(Date.UTC(curYear - 1, curMonth + 1, 0, 23, 59, 59, 999));
    const prevStart = new Date(prevStartCivil.getTime() - ASIA_DHAKA_OFFSET_MS);
    const prevEnd = new Date(prevEndCivil.getTime() - ASIA_DHAKA_OFFSET_MS);

    const currentKeys = generateAsiaDhakaBucketKeys(currentStart, currentEnd, "month");
    const previousKeys = generateAsiaDhakaBucketKeys(prevStart, prevEnd, "month");

    return {
      preset,
      granularity: "month",
      currentWindow: { start: currentStart, end: currentEnd },
      previousWindow: { start: prevStart, end: prevEnd },
      currentKeys,
      previousKeys,
    };
  }

  // Daily presets (7d, 30d, 90d)
  const days = rule.days ?? 30;
  const startCivil = new Date(
    Date.UTC(refDhaka.getUTCFullYear(), refDhaka.getUTCMonth(), refDhaka.getUTCDate() - (days - 1), 0, 0, 0, 0),
  );
  const currentStart = new Date(startCivil.getTime() - ASIA_DHAKA_OFFSET_MS);

  const prevStartCivil = new Date(
    Date.UTC(
      refDhaka.getUTCFullYear(),
      refDhaka.getUTCMonth(),
      refDhaka.getUTCDate() - (days * 2 - 1),
      0,
      0,
      0,
      0,
    ),
  );
  const prevEndCivil = new Date(
    Date.UTC(
      refDhaka.getUTCFullYear(),
      refDhaka.getUTCMonth(),
      refDhaka.getUTCDate() - days,
      23,
      59,
      59,
      999,
    ),
  );
  const prevStart = new Date(prevStartCivil.getTime() - ASIA_DHAKA_OFFSET_MS);
  const prevEnd = new Date(prevEndCivil.getTime() - ASIA_DHAKA_OFFSET_MS);

  const currentKeys = generateAsiaDhakaBucketKeys(currentStart, currentEnd, "day");
  const previousKeys = generateAsiaDhakaBucketKeys(prevStart, prevEnd, "day");

  return {
    preset,
    granularity: "day",
    currentWindow: { start: currentStart, end: currentEnd },
    previousWindow: { start: prevStart, end: prevEnd },
    currentKeys,
    previousKeys,
  };
}

/**
 * Pure function computing win rate as a percentage rounded to 1 decimal place.
 * Clamped between 0 and 100.
 *
 * For Farmer: auctions sold vs total auctions (sold / (sold + expiredUnsold + cancelled))
 * For Buyer: auctions won vs total participated auctions (won / (won + lost))
 *
 * Returns 0 if total <= 0 or wonOrSold <= 0.
 */
export function calculateWinRate(wonOrSold: number, total: number): number {
  if (
    typeof wonOrSold !== "number" ||
    typeof total !== "number" ||
    !Number.isFinite(wonOrSold) ||
    !Number.isFinite(total)
  ) {
    return 0;
  }
  if (total <= 0 || wonOrSold <= 0) {
    return 0;
  }
  const rate = (wonOrSold / total) * 100;
  const clamped = Math.min(100, Math.max(0, rate));
  return Math.round(clamped * 10) / 10;
}

export const winRate = calculateWinRate;

/**
 * Pure function computing period-over-period percentage change:
 * ((current - previous) / previous) * 100
 *
 * CRITICAL RULE:
 * Returns `null` when previous is zero, null, or undefined ("no delta when the previous value is zero").
 * Rounds to 1 decimal place.
 */
export function calculatePercentChange(
  current: number,
  previous?: number | null,
): number | null {
  if (previous === undefined || previous === null) {
    return null;
  }
  if (
    typeof current !== "number" ||
    typeof previous !== "number" ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return null;
  }
  // Hard requirement: no delta when previous is zero
  if (previous === 0) {
    return null;
  }

  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

export const percentChange = calculatePercentChange;

/**
 * Pure function that takes expected bucket keys in order and existing sparse
 * items, returning a continuous sequence where missing bucket keys are filled
 * with zero-initialized default items.
 */
export function fillSeriesBuckets<T extends { bucket: string }>(
  bucketKeys: readonly string[],
  existingItems: readonly T[],
  createDefault: (bucketKey: string) => T,
): T[] {
  const map = new Map<string, T>();
  for (const item of existingItems) {
    map.set(item.bucket, item);
  }

  return bucketKeys.map((bucket) => {
    const existing = map.get(bucket);
    return existing ? { ...existing } : createDefault(bucket);
  });
}

export const seriesFilling = fillSeriesBuckets;

/**
 * Fills a numeric time-series with zero for missing bucket keys.
 */
export function fillNumericSeries(
  bucketKeys: readonly string[],
  sparseData:
    | Record<string, number>
    | Map<string, number>
    | readonly { bucket: string; value: number }[],
  defaultValue = 0,
): { bucket: string; value: number }[] {
  const map = new Map<string, number>();

  if (Array.isArray(sparseData)) {
    for (const item of sparseData) {
      map.set(item.bucket, item.value);
    }
  } else if (sparseData instanceof Map) {
    for (const [k, v] of sparseData.entries()) {
      map.set(k, v);
    }
  } else if (typeof sparseData === "object" && sparseData !== null) {
    for (const [k, v] of Object.entries(sparseData)) {
      map.set(k, v);
    }
  }

  return bucketKeys.map((bucket) => ({
    bucket,
    value: map.get(bucket) ?? defaultValue,
  }));
}
