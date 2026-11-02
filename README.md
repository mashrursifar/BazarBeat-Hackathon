# BazarBeat — Better Price, Stronger Farmer

BazarBeat is a two-sided agri-marketplace where rural farmers list fresh produce, an AI grades the quality (A/B/C) and suggests a fair price, and buyers across the country compete in **time-limited bidding**. If bids do not reach the farmer's floor price, the farmer simply sells at the local market — BazarBeat can never leave them worse off.

## The 30-second pitch
1. Farmer photographs a crop → AI assigns grade A/B/C and a price range.
2. Farmer sets a floor price and an auction timer, then publishes.
3. Buyers nationwide compare listings and bid.
4. Timer ends → highest bid ≥ floor wins an order; otherwise the farmer is free to sell locally.

## Users
| Role | Goal |
|---|---|
| Farmer | Get a better price than the local market, with no middlemen and no risk |
| Buyer | Discover graded produce from all over the country, compare, and buy at competitive prices |

## Scope (MVP crops)
Onion, Green Chilli, Bottle Gourd, Eggplant, and one more crop (TBD — see `docs/DECISIONS.md` D-02). Crops live in a seeded catalog so the list is data, not code.

## Tech stack
- **Frontend:** React + TypeScript, Vite, Tailwind CSS, shadcn/ui, react-router
- **Backend:** Node.js, Express, TypeScript
- **Database:** MongoDB + Mongoose
- **Auth:** httpOnly-cookie JWT sessions (see `docs/SECURITY.md`)
- **Testing:** Vitest (unit/integration) + Playwright (end-to-end)
- Approved additions are listed in `docs/ARCHITECTURE.md` §Stack additions.

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
| File | Read it when you are... |
|---|---|
| `AGENTS.md` | starting ANY task (mandatory) |
| `docs/PRD.md` | unsure what to build or why |
| `docs/ARCHITECTURE.md` | deciding where code lives |
| `docs/DESIGN_PATTERNS.md` | deciding how to structure code |
| `docs/CODING_STANDARDS.md` | writing or reviewing code |
| `docs/DATA_MODEL.md` | touching the database or types |
| `docs/API_SPEC.md` | adding or calling an endpoint |
| `docs/AUCTION_RULES.md` | touching bidding, listings, or orders |
| `docs/AI_INTEGRATION.md` | touching grading or price prediction |
| `docs/UI_UX_GUIDELINES.md` | building any screen |
| `docs/SECURITY.md` | touching auth, uploads, or user data |
| `docs/TESTING.md` | writing tests |
| `docs/BUILD_PLAN.md` | choosing the next task |
| `docs/DECISIONS.md` | questioning a past choice or logging a new one |

## Getting started (filled in during Phase 0)
Prerequisites, install, env setup, seed, run, and test commands are added here by the agent at the end of Phase 0 and kept current afterwards.

## Demo mode
A configuration flag shortens auction durations to a couple of minutes and loads seeded farmers, buyers, listings, and bids so the full story can be shown live in a few minutes.
