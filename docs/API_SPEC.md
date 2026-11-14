# API Specification — BazarBeat

Base path: `/api/v1`. JSON only (uploads are multipart). Auth via httpOnly cookies unless noted. All request/response shapes are zod schemas in `packages/shared`. Update this file whenever a route changes.

State-changing requests require the `X-CSRF-Protection: 1` header.

## Conventions

**Success envelope:** `{ data, meta? }` where `meta` carries pagination `{ page, limit, total }` and server time `{ serverTime }` on listing/bid responses.
**Error envelope:** `{ error: { code, message, details? } }`.
**Pagination:** `?page=1&limit=20` (limit max 50). **Sorting:** `?sort=endsAt` or `-createdAt`.
**Roles:** F = farmer, B = buyer, A = any authenticated, P = public.

## Error codes

`VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `RATE_LIMITED` 429 · `INTERNAL` 500 · Business: `AUCTION_CLOSED`, `BID_TOO_LOW`, `CANNOT_OUTBID_SELF`, `OWN_LISTING`, `INSUFFICIENT_STOCK`, `GRADE_UNAVAILABLE`, `GRADE_STALE`, `CROP_MISMATCH`, `INVALID_TRANSITION`, `HAS_BIDS`, `NO_BIDS`, `BELOW_FLOOR` (400, 403, 409, or 422 as noted in the module).

## Auth

| Method | Path           | Role | Purpose                                                   |
| ------ | -------------- | ---- | --------------------------------------------------------- |
| POST   | /auth/register | P    | Create farmer or buyer account                            |
| POST   | /auth/login    | P    | Login by phone + password, sets cookies                   |
| POST   | /auth/refresh  | A    | Rotate the refresh cookie; reuse revokes the token family |
| POST   | /auth/logout   | A    | Revoke the presented refresh token and clear cookies      |
| GET    | /me            | A    | Current user profile                                      |
| PATCH  | /me            | A    | Update profile and language                               |

## Catalog and market data

| GET | /crops | P | Active crops with id, slug, English/Bangla names, unit, lot limits, shelf life, grade guide, minimum increment (integer poisha/kg), and image URL |
| GET | /market-prices?cropId&division&range | A | Price history and trend |
| GET | /market-prices/national-summary | B | Avg listing price per crop per division |

## AI

| POST | /ai/assess-quality | F | Multipart: cropId + 1–4 images → grade result |
| POST | /ai/predict-price | F | cropId, grade, quantityKg, optional local selling cost → price guidance |
Results are returned to the client and also re-verified on listing creation via a short-lived assessment token (see `AI_INTEGRATION.md`), so clients cannot forge a grade.

## Inventory (F)

| GET | /inventory | One entry per active crop, including zero totals; each entry has crop plus available/listed/sold kg |
| POST | /inventory/add | Add harvested stock `{ cropId, quantityKg, note? }`; returns the updated inventory summary item. Quantity is positive kg, at most one decimal place and 5,000 kg; note max 200 characters |
| GET | /inventory/movements?cropId&page&limit | `cropId` is required; returns the farmer's ledger entries newest first with movement type, positive quantity, references, note, and creation time; page defaults to 1, limit defaults to 20 (max 50) |

All inventory responses are scoped to the authenticated farmer; clients cannot submit a farmer ID.

## Listings

| POST | /listings | F | Create and publish (requires valid assessment token, stock, valid floor and duration). Returns meta with `serverTime` |
| GET | /listings | A | Marketplace search with filters: cropId, grade, division, district, minPrice, maxPrice, minQty, endingWithin, status (default ACTIVE); sort |
| GET | /listings/:id | A | Detail incl. bid summary and AI data (farmers see their own in any status; other roles see ACTIVE listings only; never exposes private fields; non-public listings return 404 for non-owners). Returns meta with `serverTime` |
| GET | /listings/mine | F | Farmer's listings with status filter (`status`), pagination (`page`, `limit`), sorted newest first. Returns meta with `serverTime`, `page`, `limit`, `total` |
| POST | /listings/:id/cancel | F | Only if zero bids (conditional atomic update; releases reserved stock; status CANCELLED; returns 400 HAS_BIDS if bids already exist) |
| POST | /listings/:id/accept-current-bid | F | Close early if current bid ≥ floor (uses closing service; creates order; status SOLD) |
| POST | /listings/:id/relist | F | Create a new listing from an unsold one with new floor & duration (re-runs stock check; keeps grade only if within shelf-life freshness window returning GRADE_STALE if expired; recomputes price guidance; sets relistedFromId; max one relist per unsold listing) |
| GET | /listings/:id/stream | A | SSE: bid.placed, auction.extended, auction.closed |
| GET | /listings/compare?ids=a,b,c,d | B | Compare payload (max 4) |

## Bids

| POST | /listings/:id/bids | B | Place bid `{ amountPerKg }` (poisha per kg). Accepts optional `Idempotency-Key` header. Returns `{ data: BidItem, meta: { serverTime } }`. Errors: `VALIDATION_ERROR`, `AUCTION_CLOSED`, `BID_TOO_LOW`, `CANNOT_OUTBID_SELF`, `OWN_LISTING` |
| GET | /listings/:id/bids | A | Bid history (bidders anonymized as `Buyer #1`, `Buyer #2`, etc. for non-owners and farmers; buyer names revealed only on confirmed order). Returns `{ data: AnonymizedBidHistoryItem[], meta: { serverTime } }` |
| GET | /bids/mine | B | My bids grouped: active (winning/outbid), won, lost |

### Real-Time Domain Events (SSE)

- `GET /listings/:id/stream` (Role: A):
  - On connect: Sends `snapshot` event with initial state: `{ listingId, currentPrice, currentBidPerKg, floorPricePerKg, bidCount, endTime, endsAt, status, serverTime }`.
  - Event patches forwarded to listeners:
    - `bid.placed`: `{ listingId, bidId, bidderLabel, currentPrice, currentBidPerKg, amountPerKg, totalAmount, bidCount, placedAt, serverTime }` (strictly excludes `buyerId` to prevent leaking internal user identities).
    - `auction.extended`: `{ listingId, endsAt, endTime, extensionCount, extendedAt, serverTime }`.
    - `auction.closed`: `{ listingId, status, closedAt, winningBidId?, winningAmountPerKg?, totalAmount?, serverTime }` (strictly excludes `winningBidderId` to prevent leaking winner identity).
  - Heartbeat: Sends comment `: heartbeat\n\n` every 20 seconds.
  - Concurrency limit: Maximum 5 open streams per user (`MAX_CONCURRENT_STREAMS_PER_USER = 5`), rejecting further connections with 429 `RATE_LIMITED`.
  - Disconnect cleanup: Cleans up heartbeat intervals and subscriber registrations with zero leaked memory.
  - Architecture constraint: In-memory single-instance hub (see ARCHITECTURE §5).
- System-wide timing defaults (`AUCTION_TIMING`):
  - Anti-sniping window: 2 minutes (`ANTI_SNIPING_TRIGGER_WINDOW_MS = 120_000`, demo mode: 15 seconds)
  - Anti-sniping extension: 2 minutes (`ANTI_SNIPING_EXTENSION_DURATION_MS = 120_000`, demo mode: 15 seconds)
  - Maximum anti-sniping extensions: 5 (`ANTI_SNIPING_MAX_EXTENSIONS = 5`)
  - Scheduler interval: 10 seconds (`SCHEDULER_INTERVAL_MS = 10_000`, demo mode: 2 seconds)
  - Client SSE fallback polling: 5 seconds (`CLIENT_POLLING_FALLBACK_MS = 5_000`)
  - SSE heartbeat interval: 20 seconds (`SSE_HEARTBEAT_INTERVAL_MS = 20_000`)
  - Max concurrent streams per user: 5 (`MAX_CONCURRENT_STREAMS_PER_USER = 5`)

## Orders

| GET | /orders | A | Role-scoped list with filters |
| GET | /orders/:id | A | Detail (participants only) |
| POST | /orders/:id/confirm | F | Farmer confirms and sets handover info |
| POST | /orders/:id/mark-paid | B | Simulated payment |
| POST | /orders/:id/mark-delivered | F | |
| POST | /orders/:id/complete | B | Buyer confirms receipt |
| POST | /orders/:id/dispute | B | P1 |
| POST | /orders/:id/cancel | A | Allowed only in states defined by the order state machine |

## Dashboards

| GET | /dashboards/farmer | F | KPIs + series: sales trend, earnings by crop, win rate, active auctions |
| GET | /dashboards/buyer | B | KPIs + series: spend trend, purchases by crop, avg price vs market, win rate |
| GET | /earnings | F | Totals, per-crop, payout statuses |
| GET | /sales | F | Paginated completed sales |

## Notifications

| GET | /notifications | A | Paginated |
| POST | /notifications/read | A | Mark ids or all as read |
| GET | /me/stream | A | SSE: notification.created |

## Watchlist (P1)

| GET/POST/DELETE | /watchlist | B | |

## Ops

| GET | /health | P | Liveness and DB status |
| GET | /config | P | Public runtime configuration: demoMode, durationPresets, platformFeeBps |

## Authorization matrix rules

- Farmers can read/modify only their own listings, inventory, and orders.
- Buyers can read all ACTIVE listings; only their own bids and orders.
- Private fields (phone, exact address, password hash) are never in listing/bid responses; contact details appear on an order only after CONFIRMED, and only to its two participants.

## Rate limits

Auth endpoints 10/min/IP · Bidding 20/min/user · AI endpoints 10/min/user · General 120/min/user.

## Idempotency

`POST /listings/:id/bids` accepts an `Idempotency-Key` header; repeated keys return the original result.
