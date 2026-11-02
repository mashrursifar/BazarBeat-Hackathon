# Design Patterns — BazarBeat

Use these patterns deliberately. Do not add a pattern that is not listed here without logging it in `DECISIONS.md`. Simplicity beats cleverness.

## Backend patterns

### 1. Controller → Service → Model (layered architecture)
The default for every feature. Controllers are thin translators; services own the rules. See `ARCHITECTURE.md` §3.

### 2. Adapter (Ports and Adapters) for external capabilities
Define an interface in the module (e.g. `GradingProvider`, `PricePredictionProvider`, `StorageProvider`, `PaymentProvider`) and ship at least a `Mock` implementation. The provider is chosen at boot from config. Services depend on the interface only. This keeps the demo working offline and makes swapping in a real model a one-file change.

### 3. State Machine for lifecycle statuses
Listing and Order statuses change only through a transition table (allowed from → to, with guard conditions and side effects). Invalid transitions raise a domain error. The transition tables are documented in `AUCTION_RULES.md` and implemented as pure, unit-tested functions.

### 4. Domain Events (in-process pub/sub)
Services emit events (`bid.placed`, `auction.closed`, `order.created`). Subscribers handle side effects: notifications, SSE broadcast, dashboard cache invalidation. Services never call notification code directly. Events are plain typed objects defined in `packages/shared`.

### 5. Strategy for pricing guidance
The suggested floor price is computed by a replaceable strategy (baseline: predicted local price × grade factor + small margin, adjusted for the farmer's optional local selling cost). Strategies are pure functions, unit-tested.

### 6. Unit-of-work via Mongo transactions (where needed)
Operations touching multiple collections that must succeed together (award auction + create order + move inventory) use a transaction. If transactions are unavailable in the environment, use ordered, idempotent steps with compensating checks and document it.

### 7. Optimistic concurrency by conditional update
Bids and status transitions use a single atomic conditional update (match on current state/value) and check the result. Never read-modify-write.

### 8. Repository-light
Do not create repository classes. Mongoose models plus focused query helpers inside the service file (or `*.queries.ts` when large) are enough.

### 9. Result and error handling
Services throw typed `AppError` subclasses (`ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`, `BusinessRuleError`). One error middleware converts them to the API error envelope. No try/catch in controllers except where wrapping is needed; use an async handler wrapper.

### 10. DTO mapping at the boundary
Never return raw Mongoose documents. Map to response shapes defined in `packages/shared`. Hide internal fields, other users' private data, and anonymize bidders for buyers.

## Frontend patterns

### 1. Feature-sliced folders
Everything for a feature (api hooks, components, pages, schemas) lives together under `features/<name>/`. Cross-feature reuse goes to `components/shared`.

### 2. Server state vs UI state
Server data lives in React Query (keys defined centrally per feature). Local UI state uses component state. Avoid global stores; if one is truly needed (auth session, theme, language), use React context with a small provider.

### 3. Container / presentational split
Pages fetch and orchestrate; presentational components receive props and render. Presentational components are easy to test and reuse.

### 4. Custom hooks for behavior
Encapsulate logic like `useCountdown`, `useListingStream` (SSE with polling fallback), `usePlaceBid`, `useRoleGuard`. Components stay declarative.

### 5. Schema-driven forms
Forms use react-hook-form with zod resolvers using the shared schemas, so client and server validation never drift.

### 6. Route guards and layouts
Role-based layouts (`FarmerLayout`, `BuyerLayout`) wrap nested routes. A guard component redirects unauthenticated users and wrong-role users. Sidebar items come from a typed config array per role, not hard-coded JSX.

### 7. Compound components for composed UI
Use compound components for things like the listing card (`ListingCard.Image`, `.Price`, `.Meta`) and compare table columns.

### 8. Optimistic UI — carefully
Allowed for watchlist and read-state. **Not allowed for bids**: show a pending state and wait for the server's verdict.

### 9. Error boundaries and consistent states
Every data view implements loading (skeleton), empty (with a call to action), error (retry), and forbidden states through shared components.

### 10. Presentation helpers are pure
Formatters (currency, weight, date, time-left) live in `lib/format` and are pure and tested. Components never format money by hand.

## Anti-patterns to avoid
- Business logic in controllers or React components
- Duplicated types between web and api
- Floats for money
- Client-side authority over auction time or winners
- Giant files (>300 lines) or giant components (>200 lines)
- God "utils" files; name files by purpose
- Catch-and-ignore of errors
- Premature abstraction: wait for the third repetition
