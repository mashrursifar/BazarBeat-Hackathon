# Data Model — BazarBeat (MongoDB + Mongoose)

Conventions: every document has `_id`, `createdAt`, `updatedAt`. Money fields are integer poisha (per kg unless stated). Enums are defined in `packages/shared/enums.ts`. This document is the contract; update it with any schema change.

## Entities overview

User 1─1 FarmerProfile or BuyerProfile · User 1─* RefreshSession · Farmer 1─* InventoryItem · InventoryItem 1─* StockMovement · Farmer 1─* Listing · Listing 1─* Bid · Listing 0..1─1 Order · User 1─* Notification · Crop 1─* MarketPrice

## User

| Field                                                                                                                                                                                                                                      | Type                 | Notes                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ---------------------------------------------- |
| role                                                                                                                                                                                                                                       | enum FARMER \| BUYER | Immutable after creation                       |
| name                                                                                                                                                                                                                                       | string               |                                                |
| phone                                                                                                                                                                                                                                      | string               | Unique, normalized (+880...), used as login ID |
| email                                                                                                                                                                                                                                      | string?              | Optional, unique sparse                        |
| passwordHash                                                                                                                                                                                                                               | string               | Never returned                                 |
| division, district, upazila?                                                                                                                                                                                                               | string               | Controlled lists in shared                     |
| organization                                                                                                                                                                                                                               | string?              | Buyers only                                    |
| language                                                                                                                                                                                                                                   | enum en \| bn        | Default en                                     |
| isActive                                                                                                                                                                                                                                   | boolean              |                                                |
| Indexes: unique phone; unique sparse email; role. Password hashes are excluded from normal Mongoose queries. Request and public-user contracts live in `packages/shared`; public user responses omit `phone`, `email`, and `passwordHash`. |

Controlled location values are stable English slugs with English and Bangla display names. The division and district lists live in `packages/shared/src/locations.ts` and are based on the Bangladesh National Portal's [division list](https://bangladesh.gov.bd/views/division-list/List-of-Divisions/) and [district list](https://bangladesh.gov.bd/views/district-list/District-List/). District records include their parent division ID.

## RefreshSession

| Field                                                          | Type     | Notes                                                      |
| -------------------------------------------------------------- | -------- | ---------------------------------------------------------- |
| userId                                                         | ref User |                                                            |
| tokenHash                                                      | string   | SHA-256 hash of the refresh JWT; never store the raw token |
| familyId                                                       | string   | Groups rotated tokens for reuse detection                  |
| expiresAt                                                      | Date     | TTL index removes expired records                          |
| revokedAt?                                                     | Date     | Set when a token or family is revoked                      |
| replacedByTokenHash?                                           | string   | Hash of the next token after rotation                      |
| Indexes: unique tokenHash; userId; familyId; TTL on expiresAt. |

## Crop (seeded catalog)

| Field              | Type       | Notes                                                         |
| ------------------ | ---------- | ------------------------------------------------------------- |
| slug               | string     | `onion`, `green-chilli`, `bitter-gourd`, `eggplant`, `potato` |
| nameEn, nameBn     | string     |                                                               |
| unit               | enum KG    | Fixed to kg in MVP                                            |
| minLotKg, maxLotKg | number     | Listing limits                                                |
| shelfLifeHours     | number     | Caps max auction duration for perishables                     |
| gradeGuide         | object     | Plain-language A/B/C criteria shown in UI                     |
| minIncrementPerKg  | int poisha | Minimum bid increase per kg; defaults to 100 (৳1.00)          |
| imageUrl           | string     | Catalog icon                                                  |
| isActive           | boolean    |                                                               |

Index: unique `slug`.

Seeded catalog values (starting values for human review):

| Crop (slug)                   | Bangla     | Lot limits (kg) | Shelf life (hours) | Minimum increment (poisha/kg) | Grade guide (A / B / C)                                                                                                                               | Image                           |
| ----------------------------- | ---------- | --------------: | -----------------: | ----------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Onion (`onion`)               | পেঁয়াজ    |        10–2,000 |                720 |                           100 | Firm, dry bulbs with intact skin / Mostly firm bulbs with minor marks / Small or uneven bulbs, still sound                                            | `/images/crops/placeholder.svg` |
| Green Chilli (`green-chilli`) | কাঁচা মরিচ |           5–500 |                 72 |                           100 | Fresh, firm, bright green pods / Fresh pods with slight bends or marks / Mixed sizes, usable with minor softness                                      | `/images/crops/placeholder.svg` |
| Bitter Gourd (`bitter-gourd`) | করলা       |        10–1,000 |                120 |                           100 | Firm, green fruit with defined ridges / Mostly firm fruit with minor marks or uneven color / Mature fruit with some yellowing, still sound and usable | `/images/crops/placeholder.svg` |
| Eggplant (`eggplant`)         | বেগুন      |        10–1,000 |                120 |                           100 | Glossy, firm fruit with fresh green caps / Firm fruit with small scratches or marks / Mixed sizes, usable with slight dullness                        | `/images/crops/placeholder.svg` |
| Potato (`potato`)             | আলু        |        10–2,000 |                720 |                           100 | Firm, clean tubers with no green patches / Firm tubers with minor scuffs or irregular shapes / Small or uneven tubers, sound and usable               | `/images/crops/placeholder.svg` |

The seed uses upserts keyed by slug, so repeated runs update these catalog values without creating duplicate crops. Tomato is deactivated when reseeding so existing databases receive the crop replacement too.

## InventoryItem

| Field                                                             | Type     | Notes                                                                                        |
| ----------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| farmerId                                                          | ref User |                                                                                              |
| cropId                                                            | ref Crop |                                                                                              |
| availableKg                                                       | number   | Not reserved                                                                                 |
| listedKg                                                          | number   | Reserved by active listings                                                                  |
| soldKg                                                            | number   | Lifetime sold                                                                                |
| pendingMovementId?                                                | string   | Internal standalone-Mongo fallback marker; blocks another movement until ledger finalization |
| Index: unique (farmerId, cropId). Invariant: no field below zero. |

## StockMovement (ledger)

| Field                                                                   | Type                                          | Notes                                                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| farmerId, cropId                                                        | refs                                          |                                                                                              |
| type                                                                    | enum ADD \| LIST \| RELEASE \| SELL \| ADJUST \| RETURN |                                                                                              |
| quantityKg                                                              | number                                                  | Positive; type gives direction                                                               |
| listingId? / orderId?                                                   | refs                                                    | Traceability                                                                                 |
| note                                                                    | string?                                                 |                                                                                              |
| operationId                                                             | string                                                  | Unique idempotency key for transaction retries and fallback recovery                         |
| status                                                                  | enum PENDING \| APPLIED                                 | PENDING is an internal fallback intent; only APPLIED movements count toward inventory totals |
| Inventory totals must always equal the sum of APPLIED ledger movements. |

### Stock movement effects

Every movement quantity is positive; the movement type defines which bucket changes. `ADJUST` records manual stock adjustments, and `RETURN` records sold goods returned from sold back to available after a cancelled order, as permitted by AUCTION_RULES §11.

| Type    | Available kg | Listed kg |   Sold kg | Meaning                                                    |
| ------- | -----------: | --------: | --------: | ---------------------------------------------------------- |
| ADD     |    +quantity |         — |         — | Newly harvested stock added                                |
| LIST    |    −quantity | +quantity |         — | Stock reserved for a published listing                     |
| RELEASE |    +quantity | −quantity |         — | Unsold listing stock returned when it closes               |
| SELL    |            — | −quantity | +quantity | Listed stock completed as a sale                           |
| ADJUST  |    ±quantity |         — |         — | Manual stock reconciliation                                |
| RETURN  |    +quantity |         — | −quantity | Cancelled order stock returned from sold to available      |

## Listing

| Field                                                                                                                                      | Type                                                        | Notes                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| farmerId                                                                                                                                   | ref User                                                    |                                                                  |
| cropId                                                                                                                                     | ref Crop                                                    |                                                                  |
| quantityKg                                                                                                                                 | number                                                      | Whole lot                                                        |
| images                                                                                                                                     | array of {url, width, height}                               | 1–4 photos                                                       |
| aiAssessment                                                                                                                               | embedded (see below)                                        | Set once at creation; immutable                                  |
| aiPriceGuidance                                                                                                                            | embedded (see below)                                        | Snapshot at creation                                             |
| floorPricePerKg                                                                                                                            | int poisha                                                  | Opening price and reserve                                        |
| buyNowPricePerKg?                                                                                                                          | int poisha                                                  | P2                                                               |
| minIncrementPerKg                                                                                                                          | int poisha                                                  | From crop config at creation                                     |
| startsAt, endsAt                                                                                                                           | Date                                                        | endsAt may extend (anti-sniping)                                 |
| originalEndsAt                                                                                                                             | Date                                                        |                                                                  |
| extensionCount                                                                                                                             | number                                                      | Cap in AUCTION_RULES                                             |
| status                                                                                                                                     | enum DRAFT \| ACTIVE \| SOLD \| EXPIRED_UNSOLD \| CANCELLED | State machine                                                    |
| currentBidPerKg                                                                                                                            | int poisha?                                                 | Denormalized highest bid                                         |
| currentBidderId?                                                                                                                           | ref User                                                    | Denormalized                                                     |
| bidCount                                                                                                                                   | number                                                      | Denormalized                                                     |
| winningBidId?                                                                                                                              | ref Bid                                                     |                                                                  |
| location                                                                                                                                   | {division, district, upazila?}                              | Copied from farmer at creation                                   |
| pickupNote                                                                                                                                 | string?                                                     |                                                                  |
| closedAt                                                                                                                                   | Date?                                                       |                                                                  |
| relistedFromId?                                                                                                                            | ref Listing                                                 | Originating unsold listing for relisted lots (gap 5)             |
| relistedToListingId?                                                                                                                       | ref Listing                                                 | Relisted lot destination, enforces one relist per unsold listing (internal DB persistence only; excluded from public/farmer API responses) |
| Indexes: (status, endsAt) for the closer; (status, cropId, location.division), (status, cropId, location.division, location.district), (status, aiAssessment.grade, endsAt), and (status, createdAt) for marketplace; (farmerId, status), (farmerId, status, endsAt) for farmer dashboard endingSoon and active listing queries. `currentBidderId` and `relistedToListingId` remain internal to the database to preserve bidder anonymity and strict schema boundaries. |

### aiAssessment (embedded)

grade (A|B|C), confidence (0–1), classProbabilities {A,B,C}, qualityNotes (string array), cropMatch (boolean), modelVersion, provider, assessedAt, imageHashes.

### aiPriceGuidance (embedded)

lowPerKg, expectedPerKg, highPerKg (poisha), trend (UP|FLAT|DOWN), confidence, modelVersion, provider, generatedAt, suggestedFloorPerKg, explanation (string array).

## AiAssessmentRecord

| Field                                                                                                              | Type                                | Notes                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------- |
| farmerId                                                                                                           | ref User                            | Authenticated farmer who initiated the assessment             |
| cropId                                                                                                             | ref Crop                            | Catalog crop evaluated                                        |
| assessmentTokenHash                                                                                                | string                              | SHA-256 hash of opaque token; raw token is never stored in DB |
| grade                                                                                                              | enum A \| B \| C                    | Quality grade                                                 |
| confidence                                                                                                         | number                              | Confidence score (0–1); must be ≥ 0.55                        |
| confidenceBand                                                                                                     | enum HIGH \| MEDIUM \| LOW          | Confidence indicator                                          |
| classProbabilities                                                                                                 | {A, B, C}                           | Grade distribution                                            |
| qualityNotes                                                                                                       | string[]                            | Plain-language observations                                   |
| cropMatch                                                                                                          | boolean                             | Must be true                                                  |
| modelVersion                                                                                                       | string                              | Model version for auditability                                |
| provider                                                                                                           | enum mock \| http                   | Provider identifier                                           |
| degraded                                                                                                           | boolean                             | Indicates mock fallback if real service was unavailable       |
| assessedAt                                                                                                         | Date                                | Assessment timestamp                                          |
| images                                                                                                             | array of {url, width, height, hash} | Processed photos stored via storage adapter                   |
| imageHashes                                                                                                        | string[]                            | Content hashes for immutability check                         |
| isConsumed                                                                                                         | boolean                             | Atomic consumption marker for single-use listing creation     |
| consumedAt?                                                                                                        | Date                                | Timestamp when consumed by listing creation                   |
| expiresAt                                                                                                          | Date                                | Short-lived (30 min) TTL index removes expired records        |
| Indexes: unique `assessmentTokenHash`; TTL on `expiresAt` (`expireAfterSeconds: 0`); `(farmerId, createdAt desc)`. |

## Bid

| Field                                                                                                                                                                                                                                | Type                         | Notes                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| listingId                                                                                                                                                                                                                            | ref                          | Associated listing                                                                                                                                           |
| buyerId                                                                                                                                                                                                                              | ref                          | Authenticated buyer placing the bid                                                                                                                          |
| amountPerKg                                                                                                                                                                                                                          | int poisha                   | Bid price per kg in integer poisha                                                                                                                           |
| totalAmount                                                                                                                                                                                                                          | int poisha                   | amount × quantity at bid time                                                                                                                                |
| seq                                                                                                                                                                                                                                  | number                       | Monotonic 1..N bid sequence number per listing                                                                                                               |
| status                                                                                                                                                                                                                               | enum ACCEPTED \| WON \| LOST | Stored status. `WINNING` and `OUTBID` are dynamic query projections computed relative to the current winning bid for the requesting buyer (AUCTION_RULES §8) |
| idempotencyKey?                                                                                                                                                                                                                      | string                       | Optional unique client key for safe retry via Idempotency-Key header                                                                                         |
| placedAt                                                                                                                                                                                                                             | Date                         | Server time stamped via Clock interface                                                                                                                      |
| Indexes: unique (listingId, seq), (listingId, amountPerKg desc), (buyerId, placedAt desc), unique (listingId, buyerId, idempotencyKey) with partial filter for string idempotencyKey. Bids are append-only; never edited or deleted. |

### Bidder Privacy and Anonymization

AUCTION_RULES §10: In public and farmer bid histories (`GET /listings/:id/bids`), buyer identities are masked behind sequential per-listing labels (`Buyer #1`, `Buyer #2`, etc.) assigned chronologically by each buyer's first bid on that listing. The raw `buyerId` is strictly concealed from farmers and competing buyers until auction award and order creation.

## IdempotencyRecord

| Field                                                                                                                       | Type        | Notes                                                               |
| --------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------- |
| key                                                                                                                         | string      | Unique idempotency key supplied via `Idempotency-Key` header        |
| userId                                                                                                                      | ref User    | Authenticated buyer who submitted the key                           |
| listingId                                                                                                                   | ref Listing | Associated listing                                                  |
| bidId                                                                                                                       | ref Bid     | Resulting created bid reference                                     |
| responseBody                                                                                                                | Mixed       | Cached response data payload returned on idempotent retries         |
| expiresAt                                                                                                                   | Date        | TTL index (`expireAfterSeconds: 0`) expiring records after 24 hours |
| Indexes: unique `(key, userId)`. Ensures repeat requests return identical original output without creating additional bids. |

## Domain Events

Domain events are typed in-process events defined in `@bazarbeat/shared` and emitted by services to decouple asynchronous side effects (SSE broadcasts, notifications, cache invalidation):

- `bid.placed`: `{ listingId, bidId, buyerId, bidderLabel, amountPerKg, totalAmount, bidCount, currentBidPerKg, placedAt }`
- `auction.extended`: `{ listingId, endsAt, extensionCount, extendedAt }`
- `auction.closed`: `{ listingId, status (SOLD | EXPIRED_UNSOLD | CANCELLED), closedAt, winningBidId?, winningBidderId?, winningAmountPerKg?, totalAmount? }`
- `order.created`: `{ orderId, listingId, farmerId, buyerId, cropId, quantityKg, pricePerKg, totalAmount, platformFee, farmerNet, createdAt }`

## Order

| Field                                                         | Type                                                                                       | Notes                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------- |
| listingId                                                     | ref, unique                                                                                | One order per listing   |
| farmerId, buyerId                                             | refs                                                                                       |                         |
| cropId, quantityKg                                            |                                                                                            | Snapshot                |
| grade                                                         | enum                                                                                       | Snapshot of AI grade    |
| pricePerKg, subtotal                                          | int poisha                                                                                 | Winning bid             |
| platformFee                                                   | int poisha                                                                                 | From `PLATFORM_FEE_BPS` |
| farmerNet                                                     | int poisha                                                                                 | subtotal − fee          |
| status                                                        | enum PENDING \| CONFIRMED \| DELIVERED \| COMPLETED \| CANCELLED \| DISPUTED | State machine (IN_TRANSIT removed; fulfilment is pickup/buyer-arranged) |
| payment                                                       | {method COD \| WALLET_SIM, status UNPAID \| PAID \| REFUNDED, paidAt?, refundedAt?}       | Simulated                                                               |
| fulfilment                                                    | {method PICKUP \| BUYER_ARRANGED, note?, handoverAt?}                         | Handover time 0–72h ahead, note ≤ 200 chars                             |
| dispute                                                       | {reason, note?, raisedAt, resolution?}?                                       | P1 dispute reasons (GRADE_MISMATCH, WEIGHT_SHORTAGE, etc.)              |
| statusHistory                                                 | array of {status, at, byUserId, note?}                                        | Audit timeline                                                          |
| confirmedAt?, deliveredAt?, completedAt?, cancelledAt?         | Date?                                                                         | Transition timestamps                                                   |
| cancelledBy?                                                  | ref User                                                                      | Cancelling participant ID                                               |
| cancelReason?, cancelNote?                                    | string?                                                                       | Cancellation audit details                                              |
| stockReturn?                                                  | {decision RETURNED \| DISCARDED, decidedAt, note?}                            | Farmer stock return decision after cancellation (only once)             |
| Indexes: (farmerId, createdAt), (farmerId, status, createdAt desc) for farmer dashboard order aggregations and pending orders, (buyerId, createdAt), status. |

### Order Participant Privacy and Handover

- **Counterparty Privacy (API_SPEC / AUCTION_RULES §10):** While an order is `PENDING`, counterparty identities are masked (anonymized names/labels, division/district only, zero phone numbers or addresses). Full contact details (phone, full location) are revealed only after the order transitions to `CONFIRMED` to the two verified participants.
- **Handover Rules:** Farmer sets `handoverAt` on confirmation: must be between current time and +72 hours ahead; optional pickup note up to 200 characters.
- **Lifecycle Timers:** Unconfirmed orders auto-cancel after 12 hours (`ORDER_TIMING.AUTO_CANCEL_HOURS = 12`, demo: 1m). Delivered orders auto-complete after 24 hours (`ORDER_TIMING.AUTO_COMPLETE_HOURS = 24`, demo: 2m) if no dispute is raised.

## Notification

userId, type (NEW_BID, OUTBID, ENDING_SOON, AUCTION_WON, AUCTION_LOST, AUCTION_SOLD, AUCTION_UNSOLD, ORDER_UPDATE), title, body, entityRef {kind, id}, isRead, readAt?. Index: (userId, isRead, createdAt desc).

## MarketPrice (reference data for AI and charts)

cropId (Crop ref), division, date (UTC day), avgPricePerKg, minPricePerKg, maxPricePerKg (integer poisha per kg), source (shared enum SEED | PLATFORM). Index: (cropId, division, date desc); unique (cropId, division, date, source) so seed reruns upsert without colliding with platform rows. The market-prices service returns the 60 newest rows for one crop and division. Platform-derived rows are written when auctions close. The synthetic seed generates 60 days for each of the 5 crops in all 8 Bangladesh divisions, with source SEED.

## WatchlistItem (P1)

userId, listingId; unique together.

## Derived data (never stored as truth)

Dashboard statistics are computed from Orders/Bids/Listings via aggregation queries in the `dashboards` module. Cache only if needed, and invalidate on domain events.

## Seed data requirements

- Crop catalog (5 crops: Onion, Green Chilli, Bitter Gourd, Eggplant, Potato) seeded via `npm run seed`.
- **Development & Demo Listings Seeder** (`npm run seed:dev-listings` via `apps/api/src/seed/dev-listings.ts`):
  - 8 farmers spanning all 8 administrative divisions of Bangladesh (>= 6 divisions required).
  - 5 buyers with distinct locations and organizations.
  - Demo credentials:
    - Demo Farmer: `01700000001` / `farmerpassword123` (Rahim Uddin, Savar, Dhaka)
    - Demo Buyer: `01712345678` / `buyerpassword123` (Demo Buyer — Karim Traders, Dhanmondi, Dhaka)
    - Demo Buyer 2: `01800000002` / `buyerpassword123` (Hafiz Enterprises, Kotwali, Chattogram)
  - 25 published listings (exactly 5 per crop across all 5 crops: 2 Grade A, 2 Grade B, 1 Grade C each).
  - Mixed states: ending soon (< 1h), medium duration (3h, 6h, 12h), long duration (24h).
  - Seeded bids on select listings to simulate active auctions, winning states, and price competition.
  - Full inventory ledger reconciliation: adds harvest stock, executes `reserveStockForListing` (`LIST` movements), and verifies that available + listed = harvest stock with zero discrepancy.
- 60 days of MarketPrice history per crop per division.
- Demo mode creates a few auctions that end within minutes.
