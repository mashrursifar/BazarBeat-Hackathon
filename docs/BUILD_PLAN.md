# Build Plan — BazarBeat

Priorities: **P0** must ship · **P1** should ship · **P2** only if time remains. Work phase by phase; each phase ends in something demoable. Do not start a phase before the previous one's acceptance checks pass. Tasks are written so an AI agent can take one per session.

## Prompt template for each session
"Read AGENTS.md and docs/BUILD_PLAN.md. Implement **Phase X, Task Y** only. Read the docs listed under 'Docs' for that task. Follow the workflow in AGENTS.md §4. Report using the format in AGENTS.md §8."

## Phase 0 — Foundation (P0)
Tasks: monorepo + workspaces; TypeScript configs; lint/format; shared package skeleton (enums, money helpers, schema folders); API skeleton (config, logger, error middleware, health route, Mongo connection); web skeleton (Vite, Tailwind, shadcn init, router, query client, i18n, theme tokens); Vitest and Playwright setup; `.env.example`; scripts; README "Getting started".
Docs: ARCHITECTURE, CODING_STANDARDS, TESTING.
Acceptance: `npm run dev` runs both apps; health route returns OK with DB status; `typecheck`, `lint`, `test` pass on an example test per layer.

## Phase 1 — Auth, roles, layouts (P0)
Tasks: user model and shared schemas; register/login/refresh/logout/me; auth middleware and role guard; web auth pages (role choice at register); `FarmerLayout` and `BuyerLayout` with config-driven sidebars and empty placeholder pages for every nav item; route guards; language switch scaffolding.
Docs: SECURITY, API_SPEC (Auth), UI_UX_GUIDELINES §3.
Acceptance: both roles can register, log in, see only their own sidebar and routes; negative authorization tests pass.

## Phase 2 — Catalog and inventory (P0)
Tasks: Crop model + seed; `GET /crops`; Inventory model, ledger, add-stock endpoint and movements; farmer Inventory page.
Docs: DATA_MODEL, API_SPEC.
Acceptance: farmer adds stock and sees available/listed/sold; ledger always matches totals (tests).

## Phase 3 — AI adapters and listing wizard (P0)
Tasks: provider interfaces and mock providers; assessment token; upload handling with sharp and storage adapter; `/ai/assess-quality`, `/ai/predict-price`; pricing strategy; `POST /listings`; farmer wizard UI (all steps); "My Products" list page.
Docs: AI_INTEGRATION, AUCTION_RULES §2–3, UI_UX_GUIDELINES §4.
Acceptance: Playwright journey 1 passes (without bidding); floor warnings shown; stock reserved on publish.

## Phase 4 — Auction engine and bidding (P0, highest risk)
Tasks: listing state machine; bid validation and atomic acceptance; anti-sniping; scheduler and idempotent closing; Clock interface; domain events; SSE hub (listing stream); farmer Crop Bidding page with live data; cancel/accept-now/unsold/relist.
Docs: AUCTION_RULES (all), ARCHITECTURE §5–6.
Acceptance: every edge case in AUCTION_RULES §12 has a passing test; parallel bid test passes; farmer sees live bids.

## Phase 5 — Buyer marketplace, compare, bidding UI (P0)
Tasks: marketplace query endpoint with filters/sort/pagination; listing detail; bid panel; compare endpoint and page with compare tray; My Bids.
Docs: API_SPEC, UI_UX_GUIDELINES §4.
Acceptance: Playwright journeys 2 and 3 pass; compare highlights best values.

## Phase 6 — Orders, sales, earnings (P0 orders; P1 sales/earnings)
Tasks: order creation on close; order state machine; farmer and buyer order pages; simulated payment; Sales page; Earnings page with fee display.
Docs: AUCTION_RULES §11, DATA_MODEL (Order).
Acceptance: journeys 4 and 5 pass; fee and net math tested.

## Phase 7 — Dashboards (P0 core KPIs; P1 charts)
Tasks: aggregation services; farmer and buyer dashboards with KPI cards and charts; Market Prices page for farmers; national overview for buyers.
Docs: DATA_MODEL (derived data), UI_UX_GUIDELINES.
Acceptance: numbers match the seeded dataset in tests.

## Phase 8 — Notifications, Bangla, polish (P1)
Tasks: notification model, event subscribers, bell UI, user SSE; watchlist; Bangla translations for all keys; empty/error states audit; accessibility pass; mobile QA.
Acceptance: UI checklist in UI_UX_GUIDELINES §6 passes; notification flow covered by tests.

## Phase 9 — Real AI, seed, demo, deploy (P1/P2)
Tasks: HTTP provider and the Python model service integration; fallback and `degraded` flag; final seed and demo mode; deployment; README polish; E2E smoke on the deployed build; demo rehearsal.
Acceptance: demo script (below) runs three times without intervention.

## Cut line
If time is short, stop at the end of Phase 6 plus the KPI part of Phase 7. A demo with grading, price guidance, live bidding, compare, and orders tells the full story.

## Demo script (4 minutes)
1. Problem in one sentence; show motto.
2. Farmer: photo → AI grade and price range → set floor → publish with a short timer.
3. Buyer on a second device: marketplace filters → compare → bid.
4. Farmer sees the live bid; anti-sniping extension; auction closes; order appears.
5. Show an unsold listing: farmer sells locally — "no risk".
6. Dashboards: farmer earnings premium vs. local estimate; buyer spend.
7. Impact statement and roadmap (real payments, logistics, more crops, voice UI in Bangla).

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Real AI model not ready | Mock providers by default; honest `provider` labelling |
| Bidding bugs under concurrency | Phase 4 tests first; atomic conditional updates |
| Scope creep | P-levels and the cut line; log anything new in DECISIONS.md |
| Live demo network failure | Seeded data, polling fallback, recorded backup video |
| AI agent drift | AGENTS.md rules, small tasks, review each diff against the checklist |
