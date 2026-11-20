# BazarBeat — Better Price, Stronger Farmer

BazarBeat is a two-sided agri-marketplace where rural farmers list fresh produce, an AI grades the quality (A/B/C) and suggests a fair price, and buyers across the country compete in **time-limited bidding**. If bids do not reach the farmer's floor price, the farmer simply sells at the local market — BazarBeat can never leave them worse off.

## The 30-second pitch

1. Farmer photographs a crop → AI assigns grade A/B/C and a price range.
2. Farmer sets a floor price and an auction timer, then publishes.
3. Buyers nationwide compare listings and bid.
4. Timer ends → highest bid ≥ floor wins an order; otherwise the farmer is free to sell locally.

## Users

| Role   | Goal                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- |
| Farmer | Get a better price than the local market, with no middlemen and no risk                   |
| Buyer  | Discover graded produce from all over the country, compare, and buy at competitive prices |

## Scope (MVP crops)

Onion, Green Chilli, Bitter Gourd, Eggplant, and Potato. Crops live in a seeded catalog so the list is data, not code.

## Tech stack

- **Frontend:** React + TypeScript, Vite, Tailwind CSS, shadcn/ui, react-router
- **Backend:** Node.js, Express, TypeScript
- **Database:** MongoDB + Mongoose
- **AI Multimodal Grading:** Google Gemini multimodal API via official `@google/genai` SDK
- **AI Price Guidance:** Statistical time-series baseline over historical wholesale market records
- **Auth:** httpOnly-cookie JWT sessions (see `docs/SECURITY.md`)
- **Testing:** Vitest (unit/integration) + Playwright (end-to-end)
- Approved additions are listed in `docs/ARCHITECTURE.md` §Stack additions.

## AI Architecture, Attribution & Evaluation

BazarBeat adheres to strict engineering principles of transparency, honest attribution, and grounded evaluation for all AI capabilities. Quality grading and price guidance operate behind typed provider interfaces (`GradingProvider` and `PricePredictionProvider`), ensuring the application can run fully offline from external services with deterministic mock fallbacks.

```
Produce Photo Upload (Farmer Wizard)
         │
         ├───> sharp: EXIF metadata stripped, re-encoded JPEG (max 768px)
         │
         ▼
┌────────────────────────────────────────────────────────┐
│             GradingProvider Interface                  │
├───────────────────────────┬────────────────────────────┤
│   GeminiGradingProvider   │    MockGradingProvider     │
│   (Google Gemini API)     │    (Offline / Kill Switch) │
├───────────────────────────┴────────────────────────────┤
│ • Agreement-Based Confidence (N=3 independent samples) │
│ • Adversarial text-in-image banner rejection           │
│ • Circuit breaker with automated fallback              │
└────────────────────────────────────────────────────────┘
```

### 1. Quality Grading via Google Gemini

Visual produce quality is evaluated by Google's multimodal **Gemini model** (`gemini-2.5-flash` / `gemini-3.1-flash-lite`) via the official `@google/genai` SDK.

- **Rubric-Grounded Inspection:** The system instruction guides the model to inspect produce exclusively against objective catalog grade guidelines for the target crop (covering skin integrity, color uniformity, size variation, and surface defects), outputting schema-constrained JSON.
- **Agreement-Based Confidence (Decision D-45):** In accordance with project policy, raw model probabilities are never treated as calibrated confidence. Confidence is derived through agreement across $N=3$ parallel independent samples at temperature 0.1. When all samples agree, confidence is marked **High** ($\ge 80\%$). Split votes are marked **Medium** or prompt a retake when confidence falls below 55%.
- **Adversarial Text Immunity:** Strict system instructions mandate produce-only visual evaluation, completely disregarding any artificial text, signs, or watermarks claiming "Grade A" in uploaded photos.
- **Empirical Measured Benchmarks (Held-Out Test Split from `docs/AI_EVALUATION.md`):**
  All figures are measured against held-out test specimens (42 test samples across all 5 crops, negative controls, and adversarial attacks) and meet or exceed all pre-defined ship gates:

| Metric                      | Majority Baseline | Mock Provider | Gemini (Test Split)          | Ship Gate Gate | Status           |
| --------------------------- | ----------------- | ------------- | ---------------------------- | -------------- | ---------------- |
| **Macro F1 Score**          | 16.7%             | 49.0%         | **77.5%** (0.7749)           | $\ge$ 70.0%    | **PASSED**       |
| **Overall Accuracy**        | 35.3%             | 50.0%         | **76.5%** (0.7647)           | —              | Substantial Gain |
| **Grade A Recall**          | 0.0%              | 40.0%         | **80.0%** (Precision: 100%)  | $\ge$ 60.0%    | **PASSED**       |
| **Grade B Recall**          | 100.0%            | 66.7%         | **66.7%** (Precision: 66.7%) | $\ge$ 60.0%    | **PASSED**       |
| **Grade C Recall**          | 0.0%              | 41.7%         | **83.3%** (Precision: 71.4%) | $\ge$ 60.0%    | **PASSED**       |
| **Adversarial Pass Rate**   | 75.0%             | 75.0%         | **100.0%** (4/4 passed)      | $\ge$ 75.0%    | **PASSED**       |
| **Crop Mismatch Detection** | 0.0%              | 0.0%          | **100.0%** (8/8 identified)  | 100.0%         | **PASSED**       |

### 2. Wholesale Price Guidance via Statistical Baseline

Rather than relying on speculative language model hallucination for wholesale commodity prices, price prediction in BazarBeat is computed by a pure functional statistical engine (`seasonal-baseline-v1` via `BaselinePricePredictionProvider`):

- **Grounded Data Source:** Evaluated on 60 days of historical wholesale daily price records across all 8 Bangladesh divisions for the 5 exchange crops (`MarketPrice` records).
- **Core Methodology:** Combines division seasonal averages, 7-day trend momentum, and quality grade multipliers (Grade A: +10%, Grade B: 1.00 baseline, Grade C: -15%), with confidence bands that widen responsibly (5% to 15%) when observations are sparse.
- **Evaluation:** Tested across 600 chronological held-out evaluation points with zero future lookahead (see `docs/AI_EVALUATION.md` Part II).

### 3. Provider Attribution, Mock Fallback & Resilience

- **True Attribution in UI:** Buyer and farmer interfaces honestly report the active provider. When live Gemini is active, badges and tooltips display **"Gemini"** / **"AI-assessed (Gemini)"**. When running under the mock provider or in degraded fallback, the interface explicitly displays **"Demo AI model"** and renders a notice explaining offline estimate mode.
- **Circuit Breaker Fallback:** On transient API rate limits (429) or upstream server errors, requests retry once with exponential backoff. After repeated failures, an in-memory circuit breaker opens and immediately falls back to `MockGradingProvider` with `degraded: true`, ensuring zero listing flow interruptions.
- **Operational Kill Switch:** Setting `AI_GRADING_PROVIDER=mock` in the server environment serves as an instant operational kill switch that routes all grading to deterministic mock logic without code changes or downtime.
- **Privacy & Safety:** All uploaded photos are stripped of EXIF metadata before transmission. No personal identifying information (PII) is ever included in AI requests. AI requests are subject to per-user rate limiting (10/min) and daily assessment caps (`AI_DAILY_ASSESSMENTS_PER_USER=20`). API credentials are strictly redacted from all structured logs, telemetry, and error payloads.

## Repository layout (target)

```
bazarbeat/
├─ AGENTS.md              # rules for AI coding agents (read first)
├─ CLAUDE.md              # pointer to AGENTS.md
├─ README.md
├─ docs/                  # the project's source of truth
├─ apps/
│  ├─ web/                # React app
│  └─ api/                # Express app
└─ packages/
   └─ shared/             # zod schemas, types, constants shared by web and api
```

## Documentation map

| File                       | Read it when you are...                        |
| -------------------------- | ---------------------------------------------- |
| `AGENTS.md`                | starting ANY task (mandatory)                  |
| `docs/PRD.md`              | unsure what to build or why                    |
| `docs/ARCHITECTURE.md`     | deciding where code lives                      |
| `docs/DESIGN_PATTERNS.md`  | deciding how to structure code                 |
| `docs/CODING_STANDARDS.md` | writing or reviewing code                      |
| `docs/DATA_MODEL.md`       | touching the database or types                 |
| `docs/API_SPEC.md`         | adding or calling an endpoint                  |
| `docs/AUCTION_RULES.md`    | touching bidding, listings, or orders          |
| `docs/AI_INTEGRATION.md`   | touching grading or price prediction           |
| `docs/UI_UX_GUIDELINES.md` | building any screen                            |
| `docs/SECURITY.md`         | touching auth, uploads, or user data           |
| `docs/TESTING.md`          | writing tests                                  |
| `docs/BUILD_PLAN.md`       | choosing the next task                         |
| `docs/DECISIONS.md`        | questioning a past choice or logging a new one |

## Getting started

### Prerequisites

- Node.js LTS and npm
- MongoDB running locally (the web app and API can start without it; the API health response reports the connection state)

### Install and configure

```sh
npm install
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env` for the second command. The example values are for local development only; replace the JWT secrets before exposing the API.

### Run the apps

```sh
npm run dev
```

The web app runs at <http://localhost:5173> and the API at <http://localhost:4000>. Check API and MongoDB status at <http://localhost:4000/api/v1/health>.

### Seed data and demo dataset

#### Quick Start (Consolidated Demo Dataset)

For demo presentations, staging reviews, and full deterministic local testing:

```sh
# 1. Populate the full deterministic demo dataset:
ALLOW_DEMO_SEED=true npm run seed:demo

# 2. Reset back to the initial deterministic state in under 30 seconds (runnable repeatedly):
ALLOW_DEMO_SEED=true npm run demo:reset

# 3. Spawn fresh 2-minute auctions for live demo closing / bidding:
ALLOW_DEMO_SEED=true npm run demo:spawn-auctions
```

> [!CAUTION]
> **Safety Guard (`ALLOW_DEMO_SEED=true`):** All demo seed, reset, and spawn commands refuse to run unless the target database is explicitly permitted by setting `ALLOW_DEMO_SEED=true` in your shell or `.env`. This prevents accidental modification of production or non-demo databases.
>
> **Credentials Warning:** Demo user accounts and credentials exist strictly in the demo database for local testing and demonstration. Never reuse real personal passwords.

#### Demo Credentials

| Role            | Name              | Phone         | Password            | Location / Org      |
| --------------- | ----------------- | ------------- | ------------------- | ------------------- |
| **Demo Farmer** | Rahim Uddin       | `01700000001` | `farmerpassword123` | Savar, Dhaka        |
| **Demo Buyer**  | Karim Traders     | `01712345678` | `buyerpassword123`  | Dhanmondi, Dhaka    |
| **Buyer 2**     | Hafiz Enterprises | `01800000002` | `buyerpassword123`  | Kotwali, Chattogram |

The demo seed includes:

- **Catalog:** 5 active MVP crops (Onion, Green Chilli, Bitter Gourd, Eggplant, Potato).
- **Farmers:** 12 farmers spanning all 8 divisions of Bangladesh (>= 6 divisions required).
- **Buyers:** 8 buyers across major districts with distinct organizations.
- **Market Prices:** 60 days of historical daily prices per crop per division.
- **Listings:** 25 active listings (5 per crop, grades A/B/C) with sample crop photos and competitive bids.
- **Orders & History:** 60 to 90 days of completed, cancelled, and in-progress orders with verified ledger reconciliation.

#### Development Seeding (Legacy / Granular)

You can also seed granular subsets for development:

```sh
npm run seed              # Seeds the 5 crops catalog
npm run seed:dev-listings # Seeds 25 listings (5 per crop), 8 farmers across 8 divisions, 5 buyers, inventory reservations and bids
```

> [!NOTE]
> **Reseeding Notice (Phase 8):** AI quality notes and price guidance explanations use structured reason codes (`GradingReasonCode` and `PriceReasonCode`) with client-side i18n translation. Existing development databases should be reseeded via `ALLOW_DEMO_SEED=true npm run demo:reset`.

### Quality checks

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

Playwright's first run may require `npx playwright install` to install its browser. The E2E web server starts automatically. End-to-end specs in `e2e/` test:

- **Journey 1:** Farmer publishing a live auction with AI quality grading and price guidance (`e2e/journey-1-farmer-publishes.spec.ts`).
- **Journey 1 (Part 2):** Floor warnings and inventory stock deduction check (`e2e/journey-1-floor-warnings-stock.spec.ts`).
- **Journey 2:** Buyer marketplace filtering, compare tray with cross-crop rejection, side-by-side compare with highlight badges, too-low bid validation with minimum-bid button, binding confirmation dialog, and buyer route isolation (`e2e/journey-2-buyer-bids-and-compares.spec.ts`).
- **Journey 3:** Multi-context live bidding where a buyer's bid updates the farmer's Crop Bidding screen without reload, and a second buyer outbids the first buyer triggering a live "You were outbid" banner (`e2e/journey-3-live-bidding-multi-context.spec.ts`).
- **Phase 4 E2E (Auction Engine & Bidding):**
  1. Live bidding updates without page reload over real-time SSE stream (`e2e/journey-phase-4-auction-bidding.spec.ts`).
  2. Late bids within anti-sniping threshold triggering the visual "Extended" timer state.
  3. Auction sold completion with post-close inventory reconciliation (listed decreases, sold increases).
  4. Auction unsold completion with relist dialog workflow and immediate re-activation in the live grid.
  5. Cancel with no bids releasing inventory, and cancellation blocked with HTTP 400 `HAS_BIDS` once bids exist.
- **Journey 4 (Orders, Handover, Payment, Delivery & Sales/Earnings):**
  Auction closing sold, order lifecycle across farmer and buyer, contact privacy masking before confirmation and reveal afterwards, handover scheduling (0-72h ahead), simulated wallet payment, delivery, buyer receipt confirmation, and sales/earnings dashboard reflection (`e2e/journey-4-orders-sales.spec.ts`).
- **Journey 5 (Unsold Relisting, Order Cancel with Stock Return, Timers & Role Isolation):**
  Auction closing unsold with relist prompt and inventory restoration, order cancellation flow with stock-return prompt (restoring available inventory), auto-cancel timer transition of unconfirmed orders, and mutual role isolation preventing role hijacking (`e2e/journey-5-unsold-and-lifecycle.spec.ts`).
- **Phase 7 E2E (Dashboards, Analytics & Market Overview):**
  1. Demo farmer and buyer dashboards displaying seeded numbers with responsive SVG/Recharts charts, crop breakdowns, and range tab switching (`e2e/journey-phase-7-dashboards.spec.ts`).
  2. Journey 4 dashboard reflection: after a short auction closes sold, farmer's booked sales and buyer's booked spend increase while active auction counts drop.
  3. Brand-new user empty states for farmer and buyer with welcoming CTAs (create first listing, explore marketplace).
  4. Strict role isolation across dashboard routes (`/farmer/dashboard` vs `/buyer/dashboard`, `/farmer/market-prices` vs `/buyer/market-overview`).
- **Phase 8 E2E (Notifications, Watchlist, Bangla & Accessibility):**
  1. Live notification delivery: buyer bids and farmer's bell badge increments live with a toast (`e2e/journey-phase-8-notifications.spec.ts`).
  2. Multi-actor outbid alert: second buyer outbids, alerting first buyer live, while farmer's unread `NEW_BID` notification coalesces onto the listing dedupe key.
  3. Auction closing outcomes: winner receives `AUCTION_WON`, farmer receives `AUCTION_SOLD`, and losing bidders receive `AUCTION_LOST`.
  4. Watchlist lifecycle: saving active listings to watchlist, ended watched listings remaining accessible read-only, and demo `ENDING_SOON` notifications.
  5. Bangla parity & localization: language switch enforcing document `lang="bn"`, localized Bengali numerals, and zero missing translation keys.
  6. Accessibility audits: automated WCAG 2.1 AA audits across Landing, Farmer, Buyer, Notifications, and Watchlist pages (`e2e/accessibility-qa.spec.ts`, `e2e/journey-phase-8-notifications.spec.ts`).

## Manually testing an auction

You can test the full bidding flow across roles in development:

1. **Start the environment:**
   Ensure MongoDB is running and start the development servers:

   ```sh
   npm run dev
   ```

   If starting from an empty database, seed the crop catalog:

   ```sh
   npm run seed
   ```

   To seed demo listings, farmers, buyers, and rich historical orders/bids for the dashboards:

   ```sh
   npm run seed:dev-listings
   # History seeding is enabled by default. To explicitly control it:
   npm run seed:dev-listings -- --history
   npm run seed:dev-listings -- --no-history
   ```

2. **Set up a buyer account:**
   - Register a buyer at <http://localhost:5173/register> (choose the **Buyer** role, e.g. Phone `01712345678`, Password `buyerpassword123`).
   - Add these credentials to your `.env` file:
     ```env
     DEV_BUYER_PHONE=01712345678
     DEV_BUYER_PASSWORD=buyerpassword123
     ```

3. **Create a listing as a farmer:**
   - Open <http://localhost:5173/register> in your browser and register as a **Farmer** (or log in).
   - Go to **Inventory** to add produce stock (e.g. 100 kg of Onion).
   - Go to **New Listing** to upload a crop photo, receive AI quality grading and price suggestions, set your floor price (e.g. ৳45.00/kg = 4500 poisha), configure the auction timer, and publish.
   - Note the `listingId` from the URL or the listing details in **My Products** / **Crop Bidding**.

4. **Place bids as the buyer via CLI:**
   Run the dev-only bidding tool from the repository root:

   ```sh
   npm run dev:bid -- <listingId> <amountPerKgInPoisha>
   ```

   For example, to place a bid of ৳46.00/kg (4,600 poisha):

   ```sh
   npm run dev:bid -- 6788f4b5c92842f1b0a81123 4600
   ```

   The script signs in as the configured buyer, submits the bid over HTTP with `X-CSRF-Protection: 1` and session cookies, and prints the server's answer:
   - If accepted, the script prints HTTP 201 with the bid item, sequence number, and server time.
   - If invalid (e.g. below floor price or current bid + minimum increment), it prints the server's rejection code and message (e.g. `BID_TOO_LOW`).
   - The script refuses to run if `NODE_ENV` is set to `production`.

5. **Observe live updates on the farmer screen:**
   Keep the farmer's listing or bidding page open (see Task 4.10) to watch incoming bids stream via SSE in real time.

_(Alternatively, you can test via Postman or Bruno by sending a `POST /api/v1/auth/login` with `{ "phone": "...", "password": "..." }`, followed by `POST /api/v1/listings/:id/bids` with `{ "amountPerKg": 4600 }`, header `X-CSRF-Protection: 1`, and the received `accessToken` cookie)._

## Demo mode

When `DEMO_MODE=true` is set in your environment:

1. **Shortened Timers:** Auction timers in the listing wizard use a fast 2-minute duration preset (`DEMO_LISTING_DURATION_PRESET_MINUTES = 2`) instead of standard multi-hour durations, allowing live bidding, expiration, and order conversion to complete during a brief presentation.
2. **Visual Indicator:** A prominent amber badge ("Demo mode: timers are shortened" / "ডেমো মোড: সময়সীমা সংক্ষিপ্ত করা হয়েছে") appears in the navigation bar across farmer, buyer, auth, and landing views to ensure presenters and reviewers are always aware that rapid timers are active.
3. **Spawning Live Auctions:** You can run `ALLOW_DEMO_SEED=true npm run demo:spawn-auctions` at any point to inject fresh 2-minute auctions with real crop photos and automated initial bids from the demo buyer, ready to demonstrate live outbidding or auction close into orders.
