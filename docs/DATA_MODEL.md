# Data Model — BazarBeat (MongoDB + Mongoose)

Conventions: every document has `_id`, `createdAt`, `updatedAt`. Money fields are integer poisha (per kg unless stated). Enums are defined in `packages/shared/enums.ts`. This document is the contract; update it with any schema change.

## Entities overview
User 1─1 FarmerProfile or BuyerProfile · Farmer 1─* InventoryItem · InventoryItem 1─* StockMovement · Farmer 1─* Listing · Listing 1─* Bid · Listing 0..1─1 Order · User 1─* Notification · Crop 1─* MarketPrice

## User
| Field | Type | Notes |
|---|---|---|
| role | enum FARMER \| BUYER | Immutable after creation |
| name | string | |
| phone | string | Unique, normalized (+880...), used as login ID |
| email | string? | Optional, unique sparse |
| passwordHash | string | Never returned |
| division, district, upazila? | string | Controlled lists in shared |
| organization | string? | Buyers only |
| language | enum en \| bn | Default en |
| isActive | boolean | |
Indexes: unique phone; role.

## Crop (seeded catalog)
| Field | Type | Notes |
|---|---|---|
| slug | string | `onion`, `green-chilli`, `bottle-gourd`, `eggplant`, plus fifth |
| nameEn, nameBn | string | |
| unit | enum KG | Fixed to kg in MVP |
| minLotKg, maxLotKg | number | Listing limits |
| shelfLifeHours | number | Caps max auction duration for perishables |
| gradeGuide | object | Plain-language A/B/C criteria shown in UI |
| imageUrl | string | Catalog icon |
| isActive | boolean | |

## InventoryItem
| Field | Type | Notes |
|---|---|---|
| farmerId | ref User | |
| cropId | ref Crop | |
| availableKg | number | Not reserved |
| listedKg | number | Reserved by active listings |
| soldKg | number | Lifetime sold |
Index: unique (farmerId, cropId). Invariant: no field below zero.

## StockMovement (ledger)
| Field | Type | Notes |
|---|---|---|
| farmerId, cropId | refs | |
| type | enum ADD \| LIST \| RELEASE \| SELL \| ADJUST | |
| quantityKg | number | Positive; type gives direction |
| listingId? / orderId? | refs | Traceability |
| note | string? | |
Inventory totals must always equal the sum of the ledger.

## Listing
| Field | Type | Notes |
|---|---|---|
| farmerId | ref User | |
| cropId | ref Crop | |
| quantityKg | number | Whole lot |
| images | array of {url, width, height} | 1–4 photos |
| aiAssessment | embedded (see below) | Set once at creation; immutable |
| aiPriceGuidance | embedded (see below) | Snapshot at creation |
| floorPricePerKg | int poisha | Opening price and reserve |
| buyNowPricePerKg? | int poisha | P2 |
| minIncrementPerKg | int poisha | From crop config at creation |
| startsAt, endsAt | Date | endsAt may extend (anti-sniping) |
| originalEndsAt | Date | |
| extensionCount | number | Cap in AUCTION_RULES |
| status | enum DRAFT \| ACTIVE \| SOLD \| EXPIRED_UNSOLD \| CANCELLED | State machine |
| currentBidPerKg | int poisha? | Denormalized highest bid |
| currentBidderId? | ref User | Denormalized |
| bidCount | number | Denormalized |
| winningBidId? | ref Bid | |
| location | {division, district, upazila?} | Copied from farmer at creation |
| pickupNote | string? | |
| closedAt | Date? | |
Indexes: (status, endsAt) for the closer; (status, cropId, location.division) and (status, createdAt) for marketplace; (farmerId, status).

### aiAssessment (embedded)
grade (A|B|C), confidence (0–1), classProbabilities {A,B,C}, qualityNotes (string array), cropMatch (boolean), modelVersion, provider, assessedAt, imageHashes.

### aiPriceGuidance (embedded)
lowPerKg, expectedPerKg, highPerKg (poisha), trend (UP|FLAT|DOWN), confidence, modelVersion, provider, generatedAt, suggestedFloorPerKg, explanation (string array).

## Bid
| Field | Type | Notes |
|---|---|---|
| listingId | ref | |
| buyerId | ref | |
| amountPerKg | int poisha | |
| totalAmount | int poisha | amount × quantity at bid time |
| status | enum ACCEPTED \| WINNING \| OUTBID \| WON \| LOST | WINNING/OUTBID may be derived rather than stored (see AUCTION_RULES) |
| placedAt | Date | Server time |
Indexes: (listingId, amountPerKg desc), (buyerId, placedAt desc). Bids are append-only; never edited or deleted.

## Order
| Field | Type | Notes |
|---|---|---|
| listingId | ref, unique | One order per listing |
| farmerId, buyerId | refs | |
| cropId, quantityKg | | Snapshot |
| grade | enum | Snapshot of AI grade |
| pricePerKg, subtotal | int poisha | Winning bid |
| platformFee | int poisha | From `PLATFORM_FEE_BPS` |
| farmerNet | int poisha | subtotal − fee |
| status | enum PENDING \| CONFIRMED \| IN_TRANSIT \| DELIVERED \| COMPLETED \| CANCELLED \| DISPUTED | State machine |
| payment | {method COD \| WALLET_SIM, status UNPAID \| PAID \| REFUNDED, paidAt?} | Simulated |
| fulfilment | {method PICKUP \| BUYER_ARRANGED, note?, handoverAt?} | |
| dispute | {reason, raisedAt, resolution?}? | P1 |
| statusHistory | array of {status, at, byUserId} | Audit |
Indexes: (farmerId, createdAt), (buyerId, createdAt), status.

## Notification
userId, type (NEW_BID, OUTBID, ENDING_SOON, AUCTION_WON, AUCTION_LOST, AUCTION_SOLD, AUCTION_UNSOLD, ORDER_UPDATE), title, body, entityRef {kind, id}, isRead, readAt?. Index: (userId, isRead, createdAt desc).

## MarketPrice (reference data for AI and charts)
cropId, division, date, avgPricePerKg, minPricePerKg, maxPricePerKg, source (SEED | PLATFORM). Index: (cropId, division, date desc). Platform-derived rows are written when auctions close.

## WatchlistItem (P1)
userId, listingId; unique together.

## Derived data (never stored as truth)
Dashboard statistics are computed from Orders/Bids/Listings via aggregation queries in the `dashboards` module. Cache only if needed, and invalidate on domain events.

## Seed data requirements
- Crop catalog (5 crops)
- 12 farmers across at least 6 divisions, 8 buyers, one demo farmer and one demo buyer with documented credentials
- 60 days of MarketPrice history per crop per division
- 20+ listings in mixed states (active, sold, unsold) with bids and orders so every dashboard has data
- Demo mode creates a few auctions that end within minutes
