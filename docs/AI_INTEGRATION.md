# AI Integration — BazarBeat

Two AI capabilities: **quality grading** from photos and **price prediction**. Both are behind provider interfaces so the product works with deterministic mocks and can later switch to real models.

## 1. Provider interfaces (contracts)
**GradingProvider.assess(input)** — input: crop slug, 1–4 image buffers. Output: grade A|B|C, confidence 0–1, class probabilities, quality notes (short plain-language reasons), cropMatch flag, model version, provider name.
**PricePredictionProvider.predict(input)** — input: crop slug, grade, quantityKg, division/district, date, optional recent market rows. Output: low, expected, high per kg (poisha), trend UP|FLAT|DOWN, confidence, explanation bullets, model version, provider name.

Provider selection: `AI_PROVIDER=mock` (default) or `http` (calls the external model service). The API never imports model-specific code outside the provider file.

## 2. Mock providers (default, always available)
- **Grading mock:** deterministic from an image hash so the same photo always gives the same grade; distribution roughly 30% A, 50% B, 20% C; a "demo override" via seeded sample photos named by grade so the live demo can show all three grades reliably.
- **Price mock:** base price per crop per division from the seeded MarketPrice history, multiplied by a grade factor (A ≈ +10%, B ≈ baseline, C ≈ −15%), a small seasonal factor by month, and a trend computed from the last 7 vs. previous 7 days. Low/high = expected ∓ a band that widens when data is sparse.
Mock outputs must be labelled in the UI as "AI estimate" like real ones, but the API response includes `provider: mock` so we never misrepresent it in the pitch.

## 3. Real model plan (recommended path)
Since the team has ML/NLP experience:
- **Grading:** a small image classifier (transfer learning, e.g. a lightweight CNN/ViT) trained per crop on a public or self-collected dataset, with a fourth "not this crop / unusable" outcome. Served as a tiny Python HTTP service (FastAPI) with one endpoint taking images and returning the output contract above.
- **Price prediction:** a gradient-boosted or simple regression model over historical price data (government agricultural marketing price bulletins if obtainable, plus platform data), features: crop, region, month, grade, recent moving averages. Same HTTP service, second endpoint.
- The Node API calls the service through the `http` provider with a timeout (8s) and one retry; on failure it falls back to the mock provider **and marks the result `degraded: true`** so the UI can show a gentle notice.
- Why only 5 crops: it bounds the data collection and model training scope — keep this explanation in the pitch.

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
- AI calls are rate limited per user and logged with duration, provider, and model version (not images).
- Timeouts and fallbacks are mandatory; the listing flow must never hard-fail due to AI downtime.
- Model version strings are stored with every assessment and prediction for traceability.

## 8. Testing
- Provider contract tests run against both mock and http (http against a stub server).
- Pricing strategy and grade-factor logic are pure functions with unit tests.
- A fixed set of sample images (one clearly A, B, C per crop) is kept in the seed assets for demos and E2E tests.
