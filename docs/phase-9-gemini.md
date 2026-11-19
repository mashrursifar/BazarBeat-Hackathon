# Phase 9, Part C alternative — Real AI with Gemini (replaces tasks 9.6 to 9.10)

Use this file **instead of Part C** of `phase-9.md`. Parts A, B and D stay exactly as they are. The Python service and the model training tasks (9.7, 9.8 as a service, 9.9) are dropped. Run each task in a fresh conversation, read the agent's plan before it codes, and commit after each task.

## The approach in one paragraph
Quality grading is a good fit for a hosted multimodal model: the API sends the (already re-encoded, EXIF-stripped) photos plus the crop's grade rubric to Gemini and gets back structured JSON. **Price prediction is not**: a language model has no reliable knowledge of today's wholesale prices, so prices come from a statistical baseline over the MarketPrice history (or real data if you can obtain it). Both stay behind the existing provider interfaces, so the mock providers remain the fallback and the kill switch.

## Before you start
- **Human:** create a Gemini API key in Google AI Studio and keep it out of the repository. Before the demo, move the project to the paid tier (link billing and prepay the minimum credit). Reasons: the free tier has tight rate limits that a live demo can exhaust, and free-tier prompts and responses may be used to improve Google's products, while paid-tier data is not. Farmers' crop photos are the only data sent; nothing identifying goes in a request.
- **Human:** collect and label crop photos for the evaluation set (Task G2). Photos of the crop only, no people. Record where each photo came from.
- Models and SDK examples change quickly. The agent must read the **current** Google documentation for image understanding, structured output and the model list before coding, and take the model ID from an environment variable, never hard-code it.

## Gaps this part must close
1. **One config switch is not enough.** Grading and pricing now use different providers. Replace the single `AI_PROVIDER` with `AI_GRADING_PROVIDER` (`mock` or `gemini`) and `AI_PRICE_PROVIDER` (`mock` or `baseline`). Setting grading back to `mock` is the kill switch.
2. **A language model's "confidence" is not a calibrated probability.** Decision (D-45): confidence comes from **agreement across several independent samples** (for example three parallel calls with the same photos and a small temperature). All agree: High. Split vote: Medium or "unavailable" (retake photos). The UI and docs call it "agreement-based confidence", never a probability. The sample count is an environment setting because each sample costs one request.
3. **Photos can contain text.** A sign saying "Grade A" in the photo must not influence the result. The prompt says to ignore any text in images, the output is schema-constrained, and the evaluation set includes such adversarial photos.
4. **Accuracy must be measured, not assumed.** The evaluation harness (Task G2) is built **before** prompt work, with a dev split for tuning the prompt and a test split used once at the end. Only numbers in `AI_EVALUATION.md` may be quoted.
5. **Quota or outage during the demo.** On errors the existing policy applies (D-42): retry once with backoff on rate limit or server errors, open a circuit breaker after repeated failures, fall back to the mock grader with `degraded: true`, and let the "Demo AI model" chip and notice show honestly. The preflight script must prove Gemini is reachable before any demo.
6. **Cost and abuse.** Limit each assessment to 4 images downscaled to a modest size, keep the existing per-user rate limit, add a per-user daily cap, log token usage and latency (never images or the key), and set a spend alert in Google's console (**Human**).
7. **Farmers should know photos are analysed by an external AI service.** Add a one-line notice in the photo step (English and Bangla).

## Decisions to log
D-44 grading via Gemini behind the provider interface, price via statistical baseline; D-45 agreement-based confidence; D-46 new dependency: the official Google GenAI SDK for JavaScript (check the current package name in the docs); D-47 split provider configuration. D-38 (data paths A and B) still governs the price model.

---

## Task G1 — Configuration split and provider scaffolding
Docs: AI_INTEGRATION §1 to §3, ARCHITECTURE §8.
Build: replace `AI_PROVIDER` with the two settings from gap 1 (boot fails with a clear message on unknown values and when `gemini` is selected without a key); add settings `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_GRADE_SAMPLES`, `GEMINI_TIMEOUT_MS`, `AI_DAILY_ASSESSMENTS_PER_USER`; keep the provider factory and the mock providers unchanged otherwise; update `.env.example`, `ARCHITECTURE.md` §8 and `AI_INTEGRATION.md`; log D-44 to D-47.
Acceptance: tests for config validation and factory selection; existing tests still pass with the mock providers; the key never appears in logs, errors or responses.

## Task G2 — Evaluation set and harness (do this before prompting)
Docs: AI_INTEGRATION §6 and §8, catalog grade guides.
**Human:** provide the labeled photos. Aim for as many as you can per crop and grade (record the counts honestly), plus about 20 "not this crop or unusable" photos (other produce, blurry, dark, non-produce) and a few adversarial photos containing text such as "Grade A". Use one written rubric (the catalog grade guides) and, if possible, have two people label a subset to see how much they agree: grading is subjective, and that agreement is the ceiling for any model.
Build in `ai-eval/`: a manifest file (path, crop, human grade, source, license, split dev or test, tags such as `negative` or `adversarial`), the images folder (committed only if licensed for it, otherwise documented and ignored), and a runner script that executes any `GradingProvider` over a split and writes a metrics JSON: per-crop and overall accuracy, per-class precision and recall, macro F1, confusion matrix, crop-mismatch detection rate on negatives, adversarial pass rate, and latency. Run it with the **mock** provider and a majority-class baseline so you have reference numbers.
Acceptance: the harness runs end to end on the mock provider; the test split is clearly separated and never used by the prompt tuning script; the manifest documents the source of every image.

## Task G3 — Gemini grading provider
Docs: AI_INTEGRATION §1 and §4, D-35 reason codes, D-42, gaps 2 to 6.
Build: the Gemini grading provider implementing `GradingProvider`. Requirements: the prompt is built from a fixed system instruction plus the crop's rubric from the catalog and the allowed reason codes from the shared enum; it instructs the model to judge only the produce, to ignore any text in images, and to say when the photos are unusable; structured output generated from the shared zod schema (crop match, image quality flag, grade, per-grade scores, reason codes with params); low temperature; several parallel samples whose agreement becomes the confidence band; mapping to the existing contract so `CROP_MISMATCH` and `GRADE_UNAVAILABLE` still work; images downscaled before sending; the model ID recorded as `modelVersion` and `provider: gemini` on every result; timeout, one retry with backoff on rate limits and server errors, the circuit breaker and the fallback described in gap 5; usage logging without images or keys. Live calls only happen in an opt-in test mode (an environment flag), never in the normal test run.
Acceptance: unit tests with a fake client for valid output, invalid JSON, schema violations, unknown reason codes, mixed samples (agreement table), rate limit then success, timeout, breaker opening and closing, and fallback with `degraded: true`; the key never appears in logs; the normal test run makes no network calls.

## Task G4 — Evaluate, tune on dev, test once, document
Docs: AI_INTEGRATION §6, G2 outputs.
Build: run the harness with the Gemini provider on the dev split, tune the prompt and sample count there only, then freeze everything and run **once** on the test split. Write `docs/AI_EVALUATION.md` (what was measured, sample counts per class and crop, metrics against the mock and majority baselines, human agreement if measured, cost and latency per assessment, failure patterns) and `docs/AI_GRADING_NOTES.md` (intended use: advisory grade, limits such as lighting, camera and subjectivity, text-in-image behavior, privacy and the free versus paid tier terms, what happens on outage). Propose a ship gate (for example macro F1 of at least 0.7 and no class recall below 0.6 on the test split) and report whether it was met. **Human:** review the numbers and decide whether to ship, label as experimental, or keep the mock for the demo.
Acceptance: metrics files committed; documents written; nothing quoted anywhere that is not in `AI_EVALUATION.md`; the decision is recorded in `DECISIONS.md`.

## Task G5 — Price provider (statistical baseline)
Docs: AI_INTEGRATION §2 and §3, D-38, `phase-9.md` Task 9.8 (data and evaluation requirements).
Build: a `baseline` price provider in the API: pure functions that compute expected, low and high prices from MarketPrice rows (seasonal average plus recent trend, grade factor, a band that widens with sparse data), with reason codes and `provider: baseline`, `modelVersion` such as `seasonal-baseline-v1`. If you obtained real price data (Path A), load it into MarketPrice with its provenance and say so in the docs. Evaluate with a **time-based split** (never random) using MAE and MAPE against a naive last-7-day-average baseline, and report it honestly in `AI_EVALUATION.md`. The UI label stays "AI estimate" only if the wording in `AI_EVALUATION.md` supports it; otherwise show "Market-based estimate".
Acceptance: unit tests for each function and boundary; evaluation script and metrics committed; the provider works with seeded and real history.

## Task G6 — Cost, quota and safety controls
Docs: SECURITY §7 and §8, AI_INTEGRATION §7.
Build: a per-user daily assessment cap (setting from G1) returning a friendly localized error; token and latency usage counters visible in logs and the deep health check (last success time, breaker state, never the key); the farmer-facing notice from gap 7 in English and Bangla; the preflight check that performs one live grading of a curated photo and compares the grade with the expected one; a documented kill-switch procedure (set grading to `mock`, redeploy or restart) in `DEPLOYMENT.md` and the runbook. **Human:** set the spend alert and confirm the paid tier before the demo.
Acceptance: tests for the cap, the notice, and the health output; the preflight fails with a readable message when the key is wrong or the quota is exhausted.

## Task G7 — Integrate, curate demo photos, smoke test, README
Docs: AI_INTEGRATION §6 and §8, `phase-9.md` Tasks 9.5 and 9.13.
Build: run the Gemini provider on candidate demo photos and keep only those graded correctly with High confidence (at least one A, B and C per crop if possible); store them as demo and e2e fixtures (the mock-only hash override must not apply to the Gemini provider); an opt-in Playwright smoke spec that uploads a curated photo against the deployed stack and expects the right grade and the model ID; update the buyer-facing "AI-assessed" tooltip and the chip so they show the true provider (Gemini, or Demo AI model when degraded or mock); update the README's AI section to state exactly: grading uses Google's Gemini model through its API (model ID, measured results from `AI_EVALUATION.md`), prices come from a statistical baseline on market history (data source stated), and what the mock fallback is.
Acceptance: the smoke spec passes on the deployed build; the preflight confirms live grading; no screen or document claims more than `AI_EVALUATION.md` supports.

---

## Acceptance for this part
- Grading uses Gemini through the existing interface, with agreement-based confidence, schema-validated output and a safe fallback
- Prices come from a documented baseline or real data, evaluated against a naive baseline
- Evaluation numbers exist, were measured on a held-out split, and are the only numbers quoted
- Keys, costs, quotas and privacy are handled, and the kill switch has been tested
- The demo photos grade correctly and confidently on the deployed build