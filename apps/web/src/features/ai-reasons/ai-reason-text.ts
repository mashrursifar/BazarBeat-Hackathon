import type { TFunction } from "i18next";
import {
  GradingReasonCode,
  PriceReasonCode,
  type PriceReasonItem,
  type QualityNote,
} from "@bazarbeat/shared";

export const FALLBACK_GRADING_REASONS: Record<GradingReasonCode, string> = {
  [GradingReasonCode.COLOR_UNIFORM]: "Consistent color",
  [GradingReasonCode.SHAPE_REGULAR]: "Regular shape",
  [GradingReasonCode.TEXTURE_FIRM]: "Firm texture",
  [GradingReasonCode.SKIN_INTACT]: "Sound skin with no rot or damage",
  [GradingReasonCode.MINOR_BLEMISHES]: "Minor surface blemishes",
  [GradingReasonCode.SIZE_VARIATION]: "Slight size variation",
  [GradingReasonCode.SURFACE_DEFECTS]: "Surface defects present",
  [GradingReasonCode.MATURITY_OPTIMAL]: "Optimal crop maturity",
  [GradingReasonCode.FRESH_HARVEST]: "Freshly harvested produce",
  [GradingReasonCode.MOISTURE_COMPLIANT]: "Optimal moisture content",
  [GradingReasonCode.VISUAL_AI_EVALUATED]: "Visual quality evaluated by AI",
};

export const FALLBACK_PRICE_REASONS: Record<PriceReasonCode, string> = {
  [PriceReasonCode.TREND_UP]: "Recent market prices trending upward",
  [PriceReasonCode.TREND_DOWN]: "Recent market prices trending downward",
  [PriceReasonCode.TREND_FLAT]: "Market prices currently stable",
  [PriceReasonCode.DEMAND_HIGH]: "High wholesale demand",
  [PriceReasonCode.DEMAND_STABLE]: "Steady market demand",
  [PriceReasonCode.SUPPLY_SURPLUS]: "Supply surplus observed in division",
  [PriceReasonCode.HISTORICAL_BENCHMARK]: "Historical price benchmark for Grade {{grade}}",
  [PriceReasonCode.DIVISION_PREMIUM]: "Regional division price premium applied",
  [PriceReasonCode.GRADE_PREMIUM]: "Premium applied for higher quality grade",
};

export function renderGradingReason(
  note: QualityNote | string | unknown,
  t: TFunction,
): string {
  if (!note) return "";
  if (typeof note === "string") return note;

  if (typeof note === "object" && note !== null && "code" in note) {
    const item = note as { code: GradingReasonCode; params?: Record<string, string | number> };
    const key = `aiReasons.grading.${item.code}`;
    const fallback = FALLBACK_GRADING_REASONS[item.code] ?? item.code;
    return t(key, { ...item.params, defaultValue: fallback });
  }

  return String(note);
}

export function renderPriceReason(
  reason: PriceReasonItem | string | unknown,
  t: TFunction,
): string {
  if (!reason) return "";
  if (typeof reason === "string") return reason;

  if (typeof reason === "object" && reason !== null && "code" in reason) {
    const item = reason as { code: PriceReasonCode; params?: Record<string, string | number> };
    const key = `aiReasons.price.${item.code}`;
    let fallback = FALLBACK_PRICE_REASONS[item.code] ?? item.code;
    if (item.params?.grade && fallback.includes("{{grade}}")) {
      fallback = fallback.replace("{{grade}}", String(item.params.grade));
    }
    return t(key, { ...item.params, defaultValue: fallback });
  }

  return String(reason);
}
