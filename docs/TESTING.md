# Testing Strategy — BazarBeat

## 1. Philosophy
Test the money and the clock first. Bidding, closing, inventory, and authorization are the highest-risk areas; they get the deepest coverage. UI polish gets lighter coverage. Tests are part of the task, not a later phase.

## 2. Test pyramid
| Level | Tool | Scope | Where |
|---|---|---|---|
| Unit | Vitest | Pure logic: money helpers, state machines, pricing strategy, formatters, zod schemas, bid validation rules | beside source (`*.test.ts`) |
| API integration | Vitest + Supertest + mongodb-memory-server | Routes with real middleware and a real in-memory Mongo; auth, roles, validation, services | `apps/api` |
| Component | Vitest + Testing Library + MSW | Key components and forms: wizard steps, bid panel, compare, countdown | `apps/web` |
| End-to-end | Playwright | Critical journeys in a real browser against seeded data and mock AI | `e2e/` |

## 3. Coverage expectations (guidance, not vanity)
- Auction engine, state machines, money helpers: ≥ 90% branch coverage
- Services overall: ≥ 75%
- UI: test behavior of critical components, not every component
Do not chase coverage numbers by testing trivial code.

## 4. Mandatory test cases
**Auth & access:** register/login/logout/refresh; wrong role on every protected route; wrong owner; expired session.
**Listings:** valid creation; missing/invalid assessment token; insufficient stock; floor and duration validation; cancel with/without bids; relist.
**Bidding:** every rule in `AUCTION_RULES.md` §4; atomic race (parallel bids); anti-sniping extension and cap; boundary at `endsAt`; idempotency key replay.
**Closing:** sold, unsold, accept-now; double-run idempotency; order creation once; inventory ledger consistent; notifications emitted.
**Orders:** every valid and invalid transition; fee and net calculation.
**Money:** rounding and totals; no float leakage.
**Dashboards:** aggregation correctness against a known seeded dataset.
**AI adapters:** contract tests for mock and http stub; fallback and `degraded` flag; crop mismatch; low-confidence handling.
**Uploads:** wrong type, too large, too many files, EXIF stripped.

## 5. Playwright journeys (P0)
1. **Farmer publishes:** login → new listing → upload sample photo → see grade and price guidance → set floor and a short timer → publish → appears in Crop Bidding.
2. **Buyer bids and compares:** login → marketplace filters → add two listings to compare → open one → place a valid bid → see updated price; invalid low bid shows error.
3. **Live update:** two browser contexts (farmer and buyer); a bid appears on the farmer's screen without refresh.
4. **Auction sold:** short-duration listing receives a bid and closes → both dashboards and orders reflect the sale.
5. **Auction unsold:** closes without qualifying bid → farmer sees relist prompt; inventory restored.
6. **Role isolation:** farmer cannot open buyer routes and vice versa.
Run with `DEMO_MODE=true` and `AI_PROVIDER=mock` for determinism. Use stable `data-testid` attributes on key controls.

## 6. Test data and determinism
- Factories/builders for users, listings, bids in test utilities; no shared mutable fixtures.
- Control time with fake timers or an injectable clock service (the API's auction code must depend on a `Clock` interface so tests can advance time).
- Seeded sample images for AI tests and demos.
- Each test cleans up its data; E2E uses a dedicated database reset script.

## 7. Commands (defined in Phase 0)
`npm run test` (all unit/integration/component), `npm run test:api`, `npm run test:web`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`.

## 8. Quality gates before merge
Typecheck, lint, unit/integration/component tests pass; Playwright smoke (journeys 1 and 2) passes on `main` before any demo.

## 9. Manual QA checklist before the demo
- [ ] Fresh database seeded; demo credentials work
- [ ] Mobile viewport walkthrough for both roles
- [ ] Slow network simulation on the listing wizard
- [ ] Anti-sniping demonstrated once in demo mode
- [ ] SSE reconnect works after toggling the network
- [ ] No console errors on core pages
