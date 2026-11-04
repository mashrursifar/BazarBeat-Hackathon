# Data Model — BazarBeat (MongoDB + Mongoose)

Conventions: every document has `_id`, `createdAt`, `updatedAt`. Money fields are integer poisha (per kg unless stated). Enums are defined in `packages/shared/enums.ts`. This document is the contract; update it with any schema change.

## Entities overview
User 1─1 FarmerProfile or BuyerProfile · User 1─* RefreshSession · Farmer 1─* InventoryItem · InventoryItem 1─* StockMovement · Farmer 1─* Listing · Listing 1─* Bid · Listing 0..1─1 Order · User 1─* Notification · Crop 1─* MarketPrice

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
Indexes: unique phone; unique sparse email; role. Password hashes are excluded from normal Mongoose queries. Request and public-user contracts live in `packages/shared`; public user responses omit `phone`, `email`, and `passwordHash`.

Controlled location values are stable English slugs with English and Bangla display names. The division and district lists live in `packages/shared/src/locations.ts` and are based on the Bangladesh National Portal's [division list](https://bangladesh.gov.bd/views/division-list/List-of-Divisions/) and [district list](https://bangladesh.gov.bd/views/district-list/District-List/). District records include their parent division ID.

## RefreshSession
| Field | Type | Notes |
|---|---|---|
| userId | ref User | |
| tokenHash | string | SHA-256 hash of the refresh JWT; never store the raw token |
| familyId | string | Groups rotated tokens for reuse detection |
| expiresAt | Date | TTL index removes expired records |
| revokedAt? | Date | Set when a token or family is revoked |
| replacedByTokenHash? | string | Hash of the next token after rotation |
Indexes: unique tokenHash; userId; familyId; TTL on expiresAt.

## Crop (seeded catalog)
| Field | Type | Notes |
|---|---|---|
| slug | string | `onion`, `green-chilli`, `bitter-gourd`, `eggplant`, `potato` |
| nameEn, nameBn | string | |
| unit | enum KG | Fixed to kg in MVP |
| minLotKg, maxLotKg | number | Listing limits |
| shelfLifeHours | number | Caps max auction duration for perishables |
| gradeGuide | object | Plain-language A/B/C criteria shown in UI |
| minIncrementPerKg | int poisha | Minimum bid increase per kg; defaults to 100 (৳1.00) |
| imageUrl | string | Catalog icon |
| isActive | boolean | |

Index: unique `slug`.

Seeded catalog values (starting values for human review):

| Crop (slug) | Bangla | Lot limits (kg) | Shelf life (hours) | Minimum increment (poisha/kg) | Grade guide (A / B / C) | Image |
|---|---|---:|---:|---:|---|---|
| Onion (`onion`) | পেঁয়াজ | 10–2,000 | 720 | 100 | Firm, dry bulbs with intact skin / Mostly firm bulbs with minor marks / Small or uneven bulbs, still sound | `/images/crops/placeholder.svg` |
| Green Chilli (`green-chilli`) | কাঁচা মরিচ | 5–500 | 72 | 100 | Fresh, firm, bright green pods / Fresh pods with slight bends or marks / Mixed sizes, usable with minor softness | `/images/crops/placeholder.svg` |
| Bitter Gourd (`bitter-gourd`) | করলা | 10–1,000 | 120 | 100 | Firm, green fruit with defined ridges / Mostly firm fruit with minor marks or uneven color / Mature fruit with some yellowing, still sound and usable | `/images/crops/placeholder.svg` |
| Eggplant (`eggplant`) | বেগুন | 10–1,000 | 120 | 100 | Glossy, firm fruit with fresh green caps / Firm fruit with small scratches or marks / Mixed sizes, usable with slight dullness | `/images/crops/placeholder.svg` |
| Potato (`potato`) | আলু | 10–2,000 | 720 | 100 | Firm, clean tubers with no green patches / Firm tubers with minor scuffs or irregular shapes / Small or uneven tubers, sound and usable | `/images/crops/placeholder.svg` |

The seed uses upserts keyed by slug, so repeated runs update these catalog values without creating duplicate crops. Tomato is deactivated when reseeding so existing databases receive the crop replacement too.

## InventoryItem
| Field | Type | Notes |
|---|---|---|
| farmerId | ref User | |
| cropId | ref Crop | |
| availableKg | number | Not reserved |
| listedKg | number | Reserved by active listings |
| soldKg | number | Lifetime sold |
| pendingMovementId? | string | Internal standalone-Mongo fallback marker; blocks another movement until ledger finalization |
Index: unique (farmerId, cropId). Invariant: no field below zero.

## StockMovement (ledger)
| Field | Type | Notes |
|---|---|---|
| farmerId, cropId | refs | |
| type | enum ADD \| LIST \| RELEASE \| SELL \| ADJUST | |
| quantityKg | number | Positive; type gives direction |
| listingId? / orderId? | refs | Traceability |
| note | string? | |
| operationId | string | Unique idempotency key for transaction retries and fallback recovery |
| status | enum PENDING \| APPLIED | PENDING is an internal fallback intent; only APPLIED movements count toward inventory totals |
Inventory totals must always equal the sum of APPLIED ledger movements.

### Stock movement effects

Every movement quantity is positive; the movement type defines which bucket changes. `ADJUST` records unsold goods returned after a cancelled order, as permitted by AUCTION_RULES §11.

| Type | Available kg | Listed kg | Sold kg | Meaning |
|---|---:|---:|---:|---|
| ADD | +quantity | — | — | Newly harvested stock added |
| LIST | −quantity | +quantity | — | Stock reserved for a published listing |
| RELEASE | +quantity | −quantity | — | Unsold listing stock returned when it closes |
| SELL | — | −quantity | +quantity | Listed stock completed as a sale |
| ADJUST | +quantity | — | — | Unsold goods returned after an eligible order cancellation |

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
cropId (Crop ref), division, date (UTC day), avgPricePerKg, minPricePerKg, maxPricePerKg (integer poisha per kg), source (shared enum SEED | PLATFORM). Index: (cropId, division, date desc); unique (cropId, division, date, source) so seed reruns upsert without colliding with platform rows. The market-prices service returns the 60 newest rows for one crop and division. Platform-derived rows are written when auctions close. The synthetic seed generates 60 days for each of the 5 crops in all 8 Bangladesh divisions, with source SEED.

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
