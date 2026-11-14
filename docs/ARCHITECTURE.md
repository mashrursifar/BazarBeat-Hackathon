# Architecture — BazarBeat

## 1. Overview
A TypeScript monorepo (npm workspaces) with a React SPA, an Express REST API, a shared contracts package, and MongoDB. Real-time bid updates use Server-Sent Events. A background scheduler closes auctions. AI, file storage, and payments are behind adapters.

```
[React SPA] ──REST + SSE──> [Express API] ──> [MongoDB]
                               │ ├─> AI adapter (mock | HTTP microservice)
                               │ ├─> Storage adapter (local disk | cloud)
                               │ └─> Payment adapter (simulated)
                               └─ Scheduler (auction closer)
```

## 2. Monorepo structure
```
apps/
  api/src/
    config/            # env parsing (zod), constants
    modules/           # feature modules, each self-contained
      auth/
      users/
      crops/
      inventory/
      listings/
      bids/
      orders/
      dashboards/
      notifications/
      market-prices/
      ai/
    shared/            # middleware, errors, logger, db, utils
    jobs/              # scheduler and job handlers
    realtime/          # SSE hub
    app.ts             # express app assembly
    server.ts          # bootstrap
    seed/              # seed scripts and demo data
  web/src/
    app/               # providers, router, layouts
    features/          # one folder per feature (auth, listings, bidding, ...)
      <feature>/
        api/           # query/mutation hooks
        components/
        pages/
        hooks/
        schemas.ts
    components/ui/     # shadcn primitives (generated, minimally edited)
    components/shared/ # app-wide composed components (CountdownTimer, GradeBadge, PriceTag ...)
    lib/               # http client, formatters, i18n, utils
    locales/           # en, bn
packages/shared/src/
  schemas/             # zod schemas per domain
  enums.ts             # roles, grades, and fixed workflow statuses; crop catalog entries are database data
  money.ts             # poisha helpers (pure functions)
  index.ts
e2e/                   # Playwright specs
docs/
```
Each API module contains: `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.model.ts`, `*.schemas.ts` (re-export from shared when possible), `*.test.ts`.

## 3. Backend layering
| Layer | Responsibility | Must not |
|---|---|---|
| Route | Map path + method to middleware chain + controller | Contain logic |
| Middleware | AuthN, role guard, validation, rate limiting, error handling | Touch models directly |
| Controller | Parse validated input, call a service, shape the HTTP response | Contain business rules |
| Service | Business rules, orchestration, transactions, state machines | Know about req/res |
| Model | Mongoose schema, indexes, static helpers | Contain business flow |
| Adapter | Wrap an external capability behind an interface | Leak vendor types |

## 4. Cross-cutting concerns
- **Validation:** zod schemas from `packages/shared` used by both API middleware and web forms.
- **Errors:** custom `AppError` hierarchy mapped to the error envelope in `API_SPEC.md`.
- **Logging:** structured JSON logger with request IDs; never log secrets, tokens, or full phone numbers.
- **Config:** one zod-validated env module; fail fast on boot.
- **Auth:** httpOnly cookie sessions (see `SECURITY.md`); role and ownership checks in middleware/services.
- **Pagination:** page + limit with total count for tables; cursor optional for feeds.
- **Idempotency:** auction closing and order creation must be safe to run twice.

## 5. Real-time design
- SSE endpoint per listing (`/listings/:id/stream`) broadcasting `bid.placed`, `auction.extended`, `auction.closed`.
  - On connect: sends an initial `snapshot` event (`listingId`, `currentPrice`, `currentBidPerKg`, `floorPricePerKg`, `bidCount`, `endTime`, `endsAt`, `status`, `serverTime`).
  - Real-time updates: forwards `bid.placed`, `auction.extended`, and `auction.closed` as small state patches.
  - Privacy guarantee: strictly filters internal user IDs (`buyerId`, `winningBidderId`) so other users' personal identifiers are never leaked over public stream channels.
  - Keep-alive: sends an SSE comment heartbeat (`: heartbeat\n\n`) every 20 seconds.
  - Concurrency control: enforces a per-user cap of 5 concurrent open streams, rejecting excess connections with HTTP 429 (`RATE_LIMITED`).
  - Automatic cleanup: disconnects clear heartbeat timers and unregister subscribers with zero memory leaks.
- SSE endpoint per user (`/me/stream`) for notifications and outbid alerts.
- **Single-instance limitation:** In-process `DomainEventEmitter` feeds the in-memory `ListingStreamHub`. Single-instance only for the hackathon MVP (per §11 and DECISIONS D-16). In multi-instance deployments, an external message broker (e.g. Redis Pub/Sub, NATS) would be required to fan out domain events across nodes.
- Client falls back to polling every 5 seconds if SSE disconnects.
- The client never decides outcomes: it displays server state and server time offset.

## 6. Scheduler
An interval job (every 10 seconds; every 2 seconds in demo mode) selects listings whose `endsAt` has passed and `status = ACTIVE`, and closes each through the auction service. Closing is idempotent and uses a conditional status transition so two ticks cannot double-close.

## 7. File uploads
Multipart upload through the storage adapter; validated for type and size; images re-encoded server-side and EXIF stripped. Local disk adapter by default; cloud adapter is a drop-in (see `AI_INTEGRATION.md` for how images flow to the grader).

## 8. Environments and config
Required variable names (values in `.env`, never committed):
`NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_DOMAIN`, `CORS_ORIGINS`, `AI_PROVIDER` (mock|http), `AI_SERVICE_URL`, `AI_SERVICE_KEY`, `STORAGE_PROVIDER` (local|cloud), `UPLOAD_DIR`, `DEMO_MODE` (true|false), `PLATFORM_FEE_BPS`, `VITE_API_URL`.
Maintain `.env.example` with every name and a safe placeholder.

## 9. Stack additions (pre-approved)
| Package | Purpose | Where |
|---|---|---|
| zod | Validation and shared contracts | shared, api, web |
| @tanstack/react-query | Server state and caching | web |
| react-hook-form + @hookform/resolvers | Forms with zod | web |
| recharts (via shadcn charts) | Dashboard charts | web |
| react-i18next | Localization (en, bn) | web |
| date-fns | Date handling | web, api |
| helmet, cors, cookie-parser, express-rate-limit | HTTP hardening | api |
| bcrypt or argon2 | Password hashing | api |
| multer + sharp | Upload parsing, image re-encode, EXIF strip | api |
| pino (+ pino-http) | Logging | api |
| supertest + mongodb-memory-server | API integration tests | api tests |
| @testing-library/react + msw | Component tests | web tests |
| browser-image-compression | Client-side image shrinking | web |
Anything else needs a `DECISIONS.md` entry first.

## 10. Deployment (hackathon)
Frontend on a static host, API on a Node host, MongoDB Atlas free tier. One shared `DEMO_MODE` seed command prepares the demo database. Health check at `/api/v1/health`.

## 11. Known limitations (state them honestly in the pitch)
Single API instance; simulated payments; AI models are prototypes; no logistics integration.
