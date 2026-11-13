import type { AssessmentResult, PredictPriceRequest, PriceGuidance } from '@bazarbeat/shared';

/**
 * Provider that assesses image(s) and returns an AI quality assessment.
 */
export interface GradingProvider {
  /**
   * Assess the quality of the given images for a specific crop.
   * Returns a contract‑validated `AssessmentResult`.
   */
  assessQuality(params: {
    cropId: string;
    images: Buffer[];
  }): Promise<AssessmentResult>;
}

/**
 * Provider that predicts a price guidance for a crop/grade/quantity.
 */
export interface PricePredictionProvider {
  /**
   * Predict price guidance. The request shape matches the shared `predictPriceRequestSchema`.
   */
  predictPrice(request: PredictPriceRequest, division?: string): Promise<PriceGuidance>;
}

