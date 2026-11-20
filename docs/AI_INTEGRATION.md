# AI Integration — BazarBeat

Two AI capabilities: **quality grading** from photos and **price prediction**. Both are behind provider interfaces so the product works with deterministic mocks and can later switch to real models.

## 1. Provider interfaces (contracts)

**GradingProvider.assess(input)** — input: crop slug, 1–4 image buffers. Output: grade A|B|C, confidence 0–1, class probabilities, quality notes (short plain-language reasons), cropMatch flag, model version, provider name.
**PricePredictionProvider.predict(input)** — input: crop slug, grade, quantityKg, division/district, date, optional recent market rows. Output: low, expected, high per kg (poisha), trend UP|FLAT|DOWN, confidence, explanation bullets, model version, provider name.

Provider selection (split configuration per Task G1 / D-47):

- `AI_GRADING_PROVIDER=mock` (default) or `gemini` (Google Gemini multimodal model). Setting back to `mock` is the operational kill switch.
- `AI_PRICE_PROVIDER=mock` (default) or `baseline` (statistical baseline over MarketPrice history).
  The API never imports provider-specific code outside the provider modules. Boot fails fast if `AI_GRADING_PROVIDER=gemini` is selected without a valid `GEMINI_API_KEY`.

## 2. Mock providers (default, always available fallback and kill switch)

- **Grading mock:** deterministic from an image hash so the same photo always gives the same grade; distribution roughly 30% A, 50% B, 20% C; a "demo override" via seeded sample photos named by grade so the live demo can show all three grades reliably.
- **Price mock:** base price per crop per division from the seeded MarketPrice history, multiplied by a grade factor (A ≈ +10%, B ≈ baseline, C ≈ −15%), a small seasonal factor by month, and a trend computed from the last 7 vs. previous 7 days. Low/high = expected ∓ a band that widens when data is sparse.
  Mock outputs are labelled in the UI as "AI estimate" like real ones, but the API response includes `provider: mock` so we never misrepresent it in the pitch.

## 3. Real model architecture (Phase 9 Gemini alternative)

- **Grading (Task G3):** Hosted multimodal model (Google Gemini via official GenAI SDK). The API sends EXIF-stripped produce photos plus the crop's rubric from the catalog and gets back structured JSON constrained to the shared zod schema. Confidence is agreement-based across `GEMINI_GRADE_SAMPLES` independent samples (D-45). Circuit breaker opens on repeated errors and safely falls back to the mock provider with `degraded: true` (D-42).
- **Price guidance (Task G5):** Statistical baseline pure functions over MarketPrice history (`BaselinePricePredictionProvider`, D-44, D-105): seasonal division average plus recent moving averages, 7-day trend momentum, grade multipliers (A: +10%, B: 1.00, C: -15%), and confidence bands that widen when observations are sparse (5% up to 15%), emitting structured `PriceReasonCode` items with `provider: baseline` and `modelVersion: seasonal-baseline-v1`. Evaluated with a strict time-based split against naive 7-day moving average in `docs/AI_EVALUATION.md`.
- **Config & safety:** Configured via `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_GRADE_SAMPLES`, `GEMINI_TIMEOUT_MS`, and `AI_DAILY_ASSESSMENTS_PER_USER`. Strict credential hygiene guarantees the API key never appears in logs, error payloads, or responses.

## 4. Image handling flow

1. Client compresses each image (max ~1600px, quality ~0.8).
2. Client posts to `/ai/assess-quality`; API validates type (jpeg/png/webp), size (≤5 MB each), count (1–4), re-encodes with sharp, strips EXIF (privacy), computes a content hash.
3. Provider returns the assessment. If `cropMatch` is false → `CROP_MISMATCH` and the UI asks for a new photo. If confidence < 0.55 → `GRADE_UNAVAILABLE` with guidance (better light, clean background, show several pieces).
4. API stores the images through the storage adapter and returns an **assessment token**: a short-lived (30 min), signed reference to the stored images and the assessment (hash-bound). `POST /listings` accepts only this token for grading data, so grade cannot be forged or changed.
5. The assessment and image hashes are stored immutably on the listing.

## 5. Photo guidance shown to farmers

Natural light, plain background, show 3+ pieces together plus one close-up, no filters, no hands covering the crop. Provide a short illustrated tip card before capture, in English and Bangla.

## 6. Trust and transparency rules

- Always show grade, confidence band (High/Medium), and short reasons.
- Always display "AI-assessed" with a tooltip explaining it is an estimate.
- Buyers can raise a grade dispute (P1). Dispute outcomes are logged as potential training data.
- Do not claim accuracy figures that were not measured. If a model is evaluated, record the metrics in `docs/AI_EVALUATION.md` (created when a real model exists) and cite only those.

## 7. Operational rules

- AI calls are rate limited per user per minute (10/min) and capped daily per user (`AI_DAILY_ASSESSMENTS_PER_USER=20`) to bound external API costs and abuse.
- AI calls are logged with duration, provider, and model version (never raw image buffers or keys).
- Timeouts (`GEMINI_TIMEOUT_MS`) and circuit-breaker fallbacks are mandatory; the listing flow must never hard-fail due to AI downtime.
- Credential hygiene: `GEMINI_API_KEY` is strictly redacted from all structured logs, error responses, and telemetry.
- Model version strings are stored with every assessment and prediction for traceability.

## 8. Testing

- Provider contract tests run against both mock and http (http against a stub server).
- Pricing strategy and grade-factor logic are pure functions with unit tests.
- A fixed set of sample images (one clearly A, B, C per crop) is kept in the seed assets for demos and E2E tests.
