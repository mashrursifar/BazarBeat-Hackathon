# Phase 9 prompts — Deploy, demo data, real AI and the finish line

This is the finale. The plan in `BUILD_PLAN.md` labels it P1/P2, but for a hackathon **deployment, demo data, preflight checks and the runbook are effectively P0**. Real AI models are P1. Run each task in a fresh conversation, read the agent's plan before it codes, and commit after each task. Some steps need you (accounts, data, photos, recording); they are marked **Human**.

## Order and cut line
Work in the order of the parts below. Parts A, B and D are required. Part C (real AI) is the first thing to cut: if time is short, keep the mock providers, label them honestly as a demo AI model, and spend the time on rehearsal.
- **Part A, deploy foundation (P0):** 9.1 to 9.3
- **Part B, demo data and control (P0):** 9.4, 9.5
- **Part C, real AI (P1):** 9.6 to 9.10
- **Part D, finish (P0):** 9.11 to 9.14

Deploy early and often: a working deployment by the end of Part A gives you a safe fallback while you work on the rest.

## Before you start
- Phase 8 acceptance passes (or you have consciously cut parts of it).
- Decide who does what. Training and data collection (9.8, 9.9) are the longest items and can run in parallel with Part B by a different person.
- **Close the open questions** in `DECISIONS.md` (D-03 data source, D-04 transport, D-05 payments in the demo, D-06 hackathon rules and format, D-07 fee) and tell the agent the answers in the relevant prompts.

## Gaps this phase must close
1. **Sessions break across different sites.** The API uses SameSite=Lax cookies, which a separate front-end domain would not send. Decision (D-37): deploy as **one service**: Express serves the built web app (with single-page-app fallback) and the API from one origin. This also keeps live updates simple (no proxy buffering) and avoids CORS. The AI service is separate.
2. **Uploaded photos vanish on most hosts.** The local-disk storage adapter loses files on every restart. Decision (D-40): add an S3-compatible storage provider (log the one new dependency), and make the seed upload its sample images through the provider.
3. **Free hosting sleeps.** A sleeping instance stops the scheduler, so auctions do not close until it wakes, and the first request is slow. Run exactly one instance, warm it before the demo, rely on the startup catch-up from Phase 4.5, and check it in the preflight script.
4. **Rate limits can lock out a whole venue.** Behind a host proxy every user looks like one IP unless `trust proxy` is set, and a shared Wi-Fi network shares one IP anyway (login is limited to 10 per minute per IP). Set trust proxy correctly and add an environment setting to relax the auth limit for the demo deployment (D-41), documented as a deliberate trade-off.
5. **AI claims must be provable.** Training data and results must be documented honestly. If you cannot get real price data, ship the statistical baseline and call it that (decision D-38 below). Never quote an accuracy number that is not in `AI_EVALUATION.md`.
6. **A degraded grade is risky.** On AI service failure the spec falls back to the mock grader and marks the result degraded. Keep that (D-42), but buyer screens already show the "Demo AI model" chip, the preflight must prove the service is up, and demo photos are chosen because the real model grades them correctly and confidently.
7. **TypeScript and Python must agree on the contract.** Maintain one contract document and one folder of golden request and response fixtures used by both test suites, and have Node validate every AI response strictly with the shared schemas. An invalid response counts as a failure and triggers the fallback.
8. **Model files need a plan.** Export to ONNX (small, CPU only), keep artifacts out of normal git history (Git LFS or a release asset with a download script and a checksum), and load and warm them at service start.
9. **Demo mode must be visible.** Show a small "Demo mode: timers are shortened" badge when `DEMO_MODE` is true so no one thinks real auctions last two minutes.
10. **You need a fast reset.** Returning the deployment to a known state before each rehearsal must take well under a minute, and fresh short auctions must be creatable right before the demo.
11. **The repository must be safe to publish.** No secrets in history, a license, dataset licenses recorded, and no uploads or models committed by accident.
12. **Feature freeze.** After the freeze only bug fixes are allowed. Tag the release, deploy from the tag, and keep the previous deployment available for rollback.

## Decisions to log
D-37 single-service deployment; D-38 AI data policy with two paths (below); D-39 ONNX and artifact handling; D-40 S3-compatible storage dependency; D-41 relaxed auth rate limit in the demo deployment; D-42 grading fallback policy stays mock with a degraded flag; D-43 secret-scanning tool and the freeze rule.

**D-38 paths.** Path A: you obtain real historical price data (for example government agricultural marketing price bulletins, if available to you) and train on it. Path B: no real data; ship a documented seasonal-average baseline as the price model, labeled "reference-price baseline built on synthetic history, real data integration planned". Either way the API reports the true model version.

---

# Part A — Deploy foundation (P0)

## Task 9.1 — Production readiness and hardening
Docs: ARCHITECTURE §8 and §10, SECURITY §6 to §9, AGENTS rule 10.
Build: production build scripts; Express serving the built web app from the same origin with SPA fallback (API routes unaffected, long-term caching for hashed assets, no caching for `index.html`); `trust proxy` configured by environment; Secure cookies in production; helmet and a content security policy that matches the fonts and scripts actually used; compression that does not break live streams; the auth rate limit setting from gap 4; graceful shutdown (close streams and stop the scheduler on termination); a deeper health check (`/api/v1/health?deep=true` reports the database, storage and AI service status plus the build version or commit); structured production logging without personal data; a boot check that refuses weak or missing secrets. Update `.env.example` and `ARCHITECTURE.md` §8 (new variables such as `TRUST_PROXY`, `SERVE_WEB`, `RATE_LIMIT_AUTH_PER_MIN`, `GIT_SHA`).
Acceptance: tests for static serving and SPA fallback, security headers, cookie flags in production mode, rate limiting using the forwarded IP, graceful shutdown, and the boot checks; a production build runs locally end to end with one command.

## Task 9.2 — Cloud storage provider
Docs: AI_INTEGRATION §4, SECURITY §4, ARCHITECTURE §7, D-40.
Build: an S3-compatible `StorageProvider` (works with any S3-compatible service; log the dependency choice), selected by `STORAGE_PROVIDER=cloud`, with environment settings for endpoint, bucket, credentials and public base URL; the same contract tests that the local provider passes; keep the Phase 3.4 upload processing unchanged; make the seed scripts upload the sample photos through whichever provider is active. Document the setup of a free S3-compatible bucket in `docs/DEPLOYMENT.md`.
Acceptance: contract tests pass for both providers (cloud with a mocked client); seeded listings show photos under the cloud provider; no credentials in logs or responses.

## Task 9.3 — First deployment and smoke test
Docs: ARCHITECTURE §10, TESTING §8.
**Human:** create the accounts you need (MongoDB Atlas, a Node host, a bucket) and paste environment variables into the host; the agent cannot do this for you.
Build: deployment files for the chosen host (container definition or the host's config file), `docs/DEPLOYMENT.md` (account setup, the full environment variable table, deploy steps, rollback, keep-warm procedure, how to run seed scripts against the hosted database from your computer), and a Playwright smoke suite that runs against a `BASE_URL` (login for both demo roles, marketplace loads with photos, a listing detail page opens, live stream connects, health check passes). Tell the agent which hosts you picked in your prompt.
Acceptance: the app is live at a public URL; the smoke suite passes against it; a restart keeps photos and data; rollback steps are written and tested once.

---

# Part B — Demo data and control (P0)

## Task 9.4 — Consolidated demo seed, reset and spawn
Docs: DATA_MODEL (Seed data requirements), BUILD_PLAN (demo script), gaps 9 and 10.
Build: one command `npm run seed:demo` that rebuilds the whole demo dataset deterministically: the crop catalog, 12 farmers across at least 6 divisions, 8 buyers, a documented demo farmer and demo buyer, 60 days of market history, 20+ listings in mixed states with bids, plus 60 to 90 days of completed, cancelled and in-progress orders (reuse the Phase 5.6 and 7.5 seeders), with sample photos uploaded through the active storage provider. Add `npm run demo:reset` (back to the initial state in under 30 seconds) and `npm run demo:spawn-auctions` (publishes a few fresh auctions that end within minutes in demo mode, using the demo farmers). Guard all of them: they refuse to run unless the target database is explicitly allowed (`ALLOW_DEMO_SEED=true`), and print the demo credentials. Add the "Demo mode: timers are shortened" badge when `DEMO_MODE` is true. Document everything in the README. Demo accounts exist only in the demo database; never reuse real passwords.
Acceptance: after reset, both demo dashboards show rich data and all ledger and consistency checks pass; spawn creates auctions that sell and close on schedule; reset can be run repeatedly.

## Task 9.5 — Preflight script
Docs: TESTING §9, DEPLOYMENT.
Build: `npm run preflight -- --url <base-url>` that checks, and prints a clear pass or fail for each: health (deep), AI service reachable and warm, database latency, storage write and read, scheduler alive (a short auction actually closes), logins for both demo roles, a full mini journey (list with a sample photo, bid, auction closes sold, order appears) followed by cleanup, and the demo badge state. It exits non-zero on any failure.
Acceptance: passes on the deployed demo; deliberately breaking one dependency (for example a wrong storage key) makes the matching check fail with a readable message.

---

# Part C — Real AI (P1)

## Task 9.6 — AI service contract and HTTP provider in the API
Docs: AI_INTEGRATION §1, §3 and §7, DECISIONS D-35 and D-42.
Build: `docs/AI_SERVICE_CONTRACT.md` and a folder of golden request and response fixtures (valid and invalid cases). Contract: `POST /v1/grade` (multipart: crop slug and images; returns grade, confidence, class probabilities, reason codes with optional params, `cropMatch`, model version), `POST /v1/price` (JSON: crop slug, grade, quantity, division, district, date and recent market rows; returns low, expected, high, trend, confidence, reason codes, model version), `GET /health` (model versions and loaded flags), authentication by an API key header. In the API, implement the HTTP providers behind the existing interfaces: strict response validation with the shared schemas, 8 second timeout with one retry, a circuit breaker (after repeated failures skip the service for 30 seconds), and the fallback to the mock providers with `degraded: true`. `AI_PROVIDER=http` becomes valid. Send recent market rows (last 60 days for the crop and division, plus the national mean) so the service stays stateless.
Acceptance: tests against a stub server for success, timeout, retry, invalid response (falls back), breaker opening and closing, and the degraded flag appearing in responses and UI; the AI key is never logged or returned.

## Task 9.7 — Python AI service skeleton
Docs: AI_SERVICE_CONTRACT, ARCHITECTURE §1, D-39.
Build in `services/ai/`: a FastAPI service implementing the contract with request validation (models matching the contract), API key authentication, size and count limits, model loading and warm-up at startup, the health endpoint, structured logs without images, a container definition, pinned dependencies and its own tests that run the golden fixtures. Use temporary placeholder models (a simple baseline for price, a trivial stand-in for grading) clearly labeled with model versions like `placeholder-0`. Log the new language and framework in `DECISIONS.md`.
Acceptance: the service passes the golden fixture tests, starts with models loaded in a few seconds, rejects missing or wrong keys, and the Node HTTP provider works against it end to end.

## Task 9.8 — Price model (P1, Human-heavy)
Docs: AI_INTEGRATION §3 and §6, D-38.
**Human:** try to obtain real historical wholesale price data. Decide Path A or Path B and say which in the prompt.
Build in `services/ai/training/price/`: the data loading and cleaning scripts with a `DATASET.md` (source, license, date range, record counts, known gaps); features from calendar and recent price rows (lags, moving averages, region); a naive baseline (last 7-day average) and a gradient-boosted or regression model (Path A), or the documented seasonal-average baseline only (Path B); evaluation with a **time-based split** (never a random split) reporting MAE and MAPE per crop against the naive baseline; export, version string and checksum; fixed seeds and a one-command reproduction. Write the findings to `docs/AI_EVALUATION.md` and a `MODEL_CARD.md`.
Acceptance: reproducible metrics file committed; the model is shipped only if it beats the naive baseline on the held-out period, otherwise the baseline ships and is labeled as such; the evaluation doc states data provenance and limits.

## Task 9.9 — Grading model (P1, Human-heavy)
Docs: AI_INTEGRATION §3, §5 and §6, catalog grade guides.
**Human:** collect and label crop photos (your own photos from markets or farms, or datasets you are licensed to use), following one written labeling rubric agreed with someone who knows the crops. Keep people out of the photos and record the source and license of every image.
Build in `services/ai/training/grading/`: a labeling rubric (`RUBRIC.md` matching the catalog grade guides), a dataset manifest with checksums and per-class counts (the images themselves are not committed), a transfer-learning pipeline on a small pretrained backbone with augmentation for lighting and background variation, an identity check for "not this crop or unusable" using negative examples (other produce, blur, non-produce), splits by capture session or source to avoid near-duplicate leakage, calibrated confidence so the 0.55 threshold means something, evaluation with per-class precision and recall, macro F1 and a confusion matrix per crop, ONNX export with a version and checksum. Report the sample counts honestly; with small counts, call the results preliminary.
Proposed ship gate (adjust as a team): macro F1 of at least 0.75 and no class recall below 0.6 on the held-out set. If the gate is missed, ship the model as "experimental" or keep the mock grader for the demo and say so.
Acceptance: reproducible metrics committed; `MODEL_CARD.md` and the dataset card written; `AI_EVALUATION.md` updated with the real numbers and limits.

## Task 9.10 — Integrate the models, curate demo photos, real-AI smoke test
Docs: AI_INTEGRATION §6 and §8, gaps 6 and 8.
Build: load the exported models into the service (artifact download script with checksum verification); deploy the service (**Human:** host account; a free CPU tier with at least 512 MB memory is typical, and models must load at start); point the API at it with `AI_PROVIDER=http`. Run the real model on candidate demo photos and keep only those it grades correctly and confidently (at least one A, B and C per crop if possible); store them as e2e and demo fixtures (the mock-only hash override must not apply to the HTTP provider). Add a Playwright real-AI smoke spec (upload a curated photo, expect the right grade and the model version in the response). Update the README AI section to state exactly what is real and what is not.
Acceptance: the smoke spec passes against the deployed stack; the preflight shows the AI service warm; the UI shows the true provider and model version; nothing in the README or UI claims more than `AI_EVALUATION.md` supports.

---

# Part D — Finish (P0)

## Task 9.11 — Load and resilience check
Docs: TESTING §9, ARCHITECTURE §11, gaps 3 and 4.
Task: a verification task. (1) Simulate about 30 concurrent users browsing the marketplace and bidding on a few listings, and 50 simultaneous live streams, against the deployed demo; report latency and errors. (2) Verify behavior behind the shared Wi-Fi scenario (many logins from one IP) with the demo rate-limit setting. (3) Restart the API during an active auction and confirm that the scheduler catch-up closes it correctly and no data is lost. (4) Time a cold start of the API and the AI service, and document the keep-warm routine. (5) Confirm the AI circuit breaker recovers after the service comes back. Fix what is inside scope and report the rest.
Acceptance: a short report with numbers; no errors at the target load; restart and cold-start behavior documented in `DEPLOYMENT.md`.

## Task 9.12 — Bug bash and feature freeze
Docs: TESTING §9, AGENTS §5.
Task: run a structured bug bash on the deployed app: a checklist of every journey for both roles in both languages on a phone and a laptop, recorded in `docs/BUG_BASH.md` with severity (blocker, major, minor). Fix blockers and majors only. **Freeze** features at the agreed time, tag the release (for example `v1.0-demo`), deploy from the tag, and keep the previous release available for rollback. After the freeze only blocker fixes may be deployed, and each must be followed by the preflight script.
Acceptance: no open blockers or majors; the tag is deployed; the rollback procedure has been tested once.

## Task 9.13 — README, runbook and submission package
Docs: README, BUILD_PLAN (demo script), D-06.
**Human:** find the hackathon's submission rules (format, deadline, required links) and tell the agent. Capture screenshots or a short GIF of the main flows and record a 2 to 3 minute backup demo video.
Build: a README written for judges (what and why, the pitch, an architecture diagram in Mermaid, tech stack, local quick start that works in under ten minutes, the demo credentials, an honest AI section, limitations, roadmap, business model with the fee from D-07, team and license); `docs/DEMO_RUNBOOK.md` with the minute-by-minute script, the exact clicks, what to prepare in the last hour, and a plan B for each failure (API asleep, AI service down, network down, auction not closing); a Q&A prep section with likely questions and honest answers (real payments, fake grades, shill bidding, rural connectivity and phones, privacy, business model, scaling); close every open question in `DECISIONS.md`; run a secret scan over the repository and its history (log the tool in D-43), add a license, and check that no datasets, models or uploads were committed.
Acceptance: a new person can run the app locally from the README alone; the runbook covers every failure listed; the secret scan is clean; docs are current.

## Task 9.14 — Rehearsal (Human-led, with the agent on call)
Docs: DEMO_RUNBOOK.
Task: run the full demo three times on the deployed build, each time starting with `demo:reset`, `demo:spawn-auctions` and the preflight script, using the real devices you will present on (a phone for the farmer, a laptop for the buyer). Time each run, note every hiccup in `docs/BUG_BASH.md`, and fix only blockers. Practice the plan B switches once. Record the final backup video from the last clean run.
Acceptance: three consecutive runs complete without intervention and within the time limit.

---

## Phase 9 acceptance (the whole project)
- The app is live on one origin with photos persisting across restarts, and the preflight script passes
- One command resets the demo and another spawns fresh short auctions; the demo badge is visible in demo mode
- The AI provider is real and measured, or honestly labeled as a baseline or demo model, and nothing claims more than `AI_EVALUATION.md` supports
- The load and restart checks pass; the rollback procedure has been tested
- The README, runbook, Q&A prep and submission package are complete; the repository is clean and licensed
- The demo ran three times in a row on the deployed build without intervention
