# API Specification — BazarBeat

Base path: `/api/v1`. JSON only (uploads are multipart). Auth via httpOnly cookies unless noted. All request/response shapes are zod schemas in `packages/shared`. Update this file whenever a route changes.

State-changing requests require the `X-CSRF-Protection: 1` header.

## Conventions

**Success envelope:** `{ data, meta? }` where `meta` carries pagination `{ page, limit, total }` and server time `{ serverTime }` on listing/bid responses.
**Error envelope:** `{ error: { code, message, details? } }`.
**Pagination:** `?page=1&limit=20` (limit max 50). **Sorting:** `?sort=endsAt` or `-createdAt`.
**Roles:** F = farmer, B = buyer, A = any authenticated, P = public.

## Error codes

`VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `RATE_LIMITED` 429 · `INTERNAL` 500 · Business: `AUCTION_CLOSED`, `BID_TOO_LOW`, `CANNOT_OUTBID_SELF`, `OWN_LISTING`, `INSUFFICIENT_STOCK`, `GRADE_UNAVAILABLE`, `GRADE_STALE`, `CROP_MISMATCH`, `COMPARE_MIXED_CROPS`, `INVALID_TRANSITION`, `HAS_BIDS`, `NO_BIDS`, `BELOW_FLOOR` (400, 403, 409, or 422 as noted in the module).

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
| GET | /listings | A | Marketplace search with filters: `crop` / `cropId`, `grade` (A, B, C), `division` and `district` (case-insensitive, district validated against division), `minPrice`, `maxPrice` (poisha/kg), `minQty` / `minQuantity`, `endingWithin` (presets: 1, 3, 6, 24 hours), `status` (default ACTIVE); `sort` (`ending-soonest`, `lowest-price`, `highest-grade`, `newest`), pagination (`page` default 1, `limit` default 20, max 50). Returns `{ data: BuyerListingCard[], meta: { serverTime, page, limit, total } }` |
| GET | /listings/:id | A | Detail incl. bid summary and AI data (farmers see their own in any status; buyers can open any ACTIVE listing plus any listing they have bid on so won and lost bids stay viewable; anything else returns 404 NOT_FOUND. Returns FarmerListing for owner farmers and BuyerListingDetail for buyers/non-owners; strictly excludes pickupNote, phone numbers, and seller identity). Returns meta with `serverTime` |
| GET | /listings/mine | F | Farmer's listings with status filter (`status`), pagination (`page`, `limit`), sorted newest first. Returns meta with `serverTime`, `page`, `limit`, `total` |
| POST | /listings/:id/cancel | F | Only if zero bids (conditional atomic update; releases reserved stock; status CANCELLED; returns 400 HAS_BIDS if bids already exist) |
| POST | /listings/:id/accept-current-bid | F | Close early if current bid ≥ floor (uses closing service; creates order; status SOLD) |
| POST | /listings/:id/relist | F | Create a new listing from an unsold one with new floor & duration (re-runs stock check; keeps grade only if within shelf-life freshness window returning GRADE_STALE if expired; recomputes price guidance; sets relistedFromId; max one relist per unsold listing) |
| GET | /listings/:id/stream | A | SSE: bid.placed, auction.extended, auction.closed |
| GET | /listings/compare?ids=a,b,c,d | B | Compare payload (1–4 listings of the same crop; returns 400 `COMPARE_MIXED_CROPS` if crops differ). Returns `{ data: ComparePayload, meta: { serverTime } }`. Highlights compute lowest price per kg, best grade (A>B>C), largest quantity, and lowest percentage vs AI expected price (best value) among ACTIVE listings; ties highlight all tied listings; ended listings are displayed without highlights |

## Bids

| POST | /listings/:id/bids | B | Place bid `{ amountPerKg }` (poisha per kg). Accepts optional `Idempotency-Key` header. Returns `{ data: BidItem, meta: { serverTime } }`. Errors: `VALIDATION_ERROR`, `AUCTION_CLOSED`, `BID_TOO_LOW` (includes `{ minimumRequiredPerKg, currentBidPerKg, floorPricePerKg, minIncrementPerKg }`), `CANNOT_OUTBID_SELF`, `OWN_LISTING` |
| GET | /listings/:id/bids | A | Bid history (bidders anonymized as `Buyer #1`, `Buyer #2`, etc. for non-owners and farmers; includes boolean `isMine` for the calling buyer; buyer names revealed only on confirmed order). Returns `{ data: AnonymizedBidHistoryItem[], meta: { serverTime } }` |
| GET | /bids/mine | B | My bids for buyers grouped by listing (highest bid per listing): filter by `?group=active|won|lost` with pagination (`?page=1&limit=20`, max 50). When `group` is set, returns `{ data: MyBidsRow[], meta: { serverTime, page, limit, total, totalPages, group } }`. When omitted, returns `{ data: { active: MyBidsRow[], won: MyBidsRow[], lost: MyBidsRow[] }, meta: { serverTime, total } }`. Each row includes listing summary, buyer's highest bid, current price, derived status (`WINNING`/`OUTBID` while active; `WON`/`LOST` after closing), gap to current price when outbid (`gapToCurrentPerKg` and `gap`), endsAt, and `orderId` when won. Sorted newest activity first |

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

| Method | Path | Role | Purpose & Contract |
| --- | --- | --- | --- |
| GET | /orders | A | Role-scoped list with query filters `?status&page=1&limit=20` (limit max 50). Returns `{ data: FarmerOrderCard[] \| BuyerOrderCard[], meta: { serverTime, page, limit, total, totalPages } }`. Counterparties masked if PENDING; revealed if CONFIRMED or later |
| GET | /orders/:id | A | Order detail with audit timeline, available actions, dispute record, and counterparty. Returns `{ data: FarmerOrderDetail \| BuyerOrderDetail, meta: { serverTime } }` (participants only; 403 FORBIDDEN for non-participants) |
| POST | /orders/:id/confirm | F | Farmer confirms order and schedules pickup/handover: payload `{ handoverAt: ISOString, note?: string (max 200), fulfilmentMethod?: PICKUP \| BUYER_ARRANGED }`. Enforces `handoverAt` between now and +72 hours ahead. Transitions PENDING → CONFIRMED |
| POST | /orders/:id/mark-paid | B | Simulated payment: payload `{ method?: COD \| WALLET_SIM }` (default WALLET_SIM). Updates independent payment status to PAID |
| POST | /orders/:id/mark-delivered | F | Farmer marks produce delivered/collected: optional `{ note?: string (max 200) }`. Transitions CONFIRMED → DELIVERED |
| POST | /orders/:id/complete | B | Buyer confirms receipt of goods: optional `{ note?: string (max 200) }`. Transitions DELIVERED → COMPLETED |
| POST | /orders/:id/dispute | B | Buyer raises quality/quantity dispute within 24h of delivery (P1, Task 6.11): payload `{ reason: GRADE_LOWER_THAN_LISTED \| QUANTITY_SHORT \| SPOILED \| OTHER, note?: string (max 200) }`. Preserves immutable AI grade snapshot and halts auto-complete timer. Transitions DELIVERED → DISPUTED |
| POST | /orders/:id/cancel | A | Allowed only in PENDING or CONFIRMED per order state machine: payload `{ reason: string, note?: string (max 200) }`. Transitions to CANCELLED; simulates wallet refund if paid by wallet |
| POST | /orders/:id/stock-return | F | Farmer decides stock return for cancelled order lot (once only): payload `{ decision: RETURNED \| DISCARDED, note?: string (max 200) }`. When RETURNED, applies ledger RETURN movement |

### Order Error Codes
`ORDER_NOT_FOUND` 404 · `INVALID_ORDER_TRANSITION` 400 · `ORDER_ACTION_NOT_ALLOWED` 403 · `ORDER_ALREADY_PAID` 400 · `HANDOVER_TIME_INVALID` 400.

## Dashboards & Sales / Earnings

| Method | Path | Role | Purpose & Contract |
| --- | --- | --- | --- |
| GET | /dashboards/farmer | F | KPIs + series: sales trend, earnings by crop, win rate, active auctions |
| GET | /dashboards/buyer | B | KPIs + series: spend trend, purchases by crop, avg price vs market, win rate |
| GET | /earnings | F | Farmer earnings summary: gross, fees, settled net (excluding CANCELLED/DISPUTED), expected net, per-crop breakdown with average premium, last 6 months series grouped in Asia/Dhaka time, average premium versus AI expected price overall, and current fee rate (200 bps / 2.0%). Returns `{ data: EarningsSummary, meta: { serverTime } }` |
| GET | /sales | F | Paginated completed sales for farmer: `?cropId&crop&from&to&startDate&endDate&buyerDivision&division&page=1&limit=20` (max 50). Returns `{ data: SaleItem[], meta: { page, limit, total, totalPages, serverTime, totals: { totalQuantityKg, totalSubtotal, totalPlatformFee, totalFarmerNet } } }` with price premium per sale |

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
