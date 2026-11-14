# Auction Hardening & Edge-Case Review Matrix

This document maps all auction rules and edge cases from `AUCTION_RULES.md` (§4, §6, §12) to their automated test suites, records concurrency stress testing results, and provides an audit of implementation consistency.

## 1. Edge-Case Matrix (§12)

| Ref | Edge Case Description | Test File | Test Suite (`describe`) | Test Name (`it`) |
|---|---|---|---|---|
| **EC1** | Two simultaneous valid bids: exactly one wins the ordering, other rejected with `BID_TOO_LOW` | `apps/api/src/modules/bids/bid.service.test.ts` | `High Concurrency Parallel Test (20+ concurrent bids)` | `AUCTION_RULES §12: exactly two simultaneous valid bids: exactly one wins the ordering, the other is rejected with BID_TOO_LOW` |
| **EC1** | Concurrency race across multiple listings & buyers under test clock | `apps/api/src/modules/auctions/concurrency-stress.test.ts` | `AUCTION_RULES Hardening & Concurrency Stress Test` | `executes 50 concurrent bids across 3 listings with scheduler running on a test clock, verifying ledger, orders, and listing summaries afterwards` |
| **EC2** | Bid at the exact `endsAt` boundary (server clock === `endsAt`) | `apps/api/src/modules/bids/bid.service.test.ts` | `Listing Status & Expiration Checks` | `rejects bid at exact endsAt boundary (now === endsAt) with 400 AUCTION_CLOSED` |
| **EC3** | Late bid triggers extension; sixth extension is not applied (5-cap) | `apps/api/src/modules/bids/bid.service.test.ts` | `Anti-Sniping Logic` | `does not extend endsAt beyond 5 extensions cap` |
| **EC4** | Bid below floor on first bid; bid below increment later | `apps/api/src/modules/bids/bid.service.test.ts` | `First Bid vs Floor Price` / `Subsequent Bid Increments` | `rejects first bid lower than floor price with 400 BID_TOO_LOW` / `rejects subsequent bid lower than current bid + increment with 400 BID_TOO_LOW` |
| **EC5** | Closing runs twice; only one order exists | `apps/api/src/modules/auctions/closing.service.test.ts` | `Re-Run Safety and Idempotence` | `is idempotent when run twice: returns existing result without creating duplicate order or ledger entries` |
| **EC5** | Scheduler tick concurrency guard | `apps/api/src/modules/auctions/scheduler.service.test.ts` | `Task 4.5 — Auction Scheduler and Startup Catch-Up` | `prevents duplicate execution on overlapping ticks` |
| **EC6** | Farmer tries to cancel with a bid | `apps/api/src/modules/listings/listing.service.test.ts` | `cancelListing` | `rejects cancellation if listing already has bids with 409 HAS_BIDS` |
| **EC6** | Farmer accepts early below floor price | `apps/api/src/modules/auctions/closing.service.test.ts` | `Early farmer acceptance` | `rejects early accept if current bid is below floor price with 400 BELOW_FLOOR` |
| **EC7** | Farmer attempts to bid on their own listing | `apps/api/src/modules/bids/bid.service.test.ts` | `Actor & Role Checks` | `rejects bid from the listing owner (farmer) with 403 OWN_LISTING` |
| **EC7** | Buyer attempts to outbid themselves | `apps/api/src/modules/bids/bid.service.test.ts` | `Self-Outbid Prohibition` | `rejects bid from current highest bidder with 409 CONFLICT` |
| **EC8** | Clock skew: client countdown reaches zero before server closes; UI shows "Finalizing…" | `apps/web/src/components/shared/countdown-timer.test.tsx` | `CountdownTimer component` | `displays 'Finalizing…' when remaining time is zero or negative and status is ACTIVE (EC8)` |
| **EC8** | Farmer Crop Bidding UI shows "Finalizing…" countdown state | `apps/web/src/features/listings/crop-bidding-page.test.tsx` | `CropBiddingPage` | `renders 'Finalizing…' countdown state when timer expires while still ACTIVE` |

---

## 2. Bid Validation Rules Matrix (§4)

| Rule | Requirement | Error Code | Test File | Test Suite (`describe`) | Test Name (`it`) |
|---|---|---|---|---|---|
| **4.1** | Actor is a BUYER and not the listing's farmer | `403 FORBIDDEN` / `403 OWN_LISTING` | `apps/api/src/modules/bids/bid.service.test.ts` | `Actor & Role Checks` | `rejects bid from a non-buyer (e.g. farmer) with 403 FORBIDDEN` and `rejects bid from the listing owner (farmer) with 403 OWN_LISTING` |
| **4.2** | Listing status is ACTIVE and server time < `endsAt` | `400 AUCTION_CLOSED` | `apps/api/src/modules/bids/bid.service.test.ts` | `Listing Status & Expiration Checks` | `rejects bid on non-ACTIVE listing with 400 AUCTION_CLOSED` and `rejects bid when server clock >= endsAt with 400 AUCTION_CLOSED` |
| **4.3** | If no bids yet: amount ≥ floor price | `400 BID_TOO_LOW` | `apps/api/src/modules/bids/bid.service.test.ts` | `First Bid vs Floor Price` | `rejects first bid lower than floor price with 400 BID_TOO_LOW` and `accepts first bid equal to floor price` |
| **4.4** | If bids exist: amount ≥ current highest + min increment | `400 BID_TOO_LOW` | `apps/api/src/modules/bids/bid.service.test.ts` | `Subsequent Bid Increments` | `rejects subsequent bid lower than current bid + increment with 400 BID_TOO_LOW` and `accepts subsequent bid meeting current bid + custom crop increment` |
| **4.5** | Amount is a positive integer poisha | `400 VALIDATION_ERROR` | `apps/api/src/modules/bids/bid.service.test.ts` | `Amount Validation` | `rejects non-integer, zero, or negative amounts with 400 VALIDATION_ERROR` |
| **4.6** | Buyer is not already highest bidder (no self-outbid) | `409 CONFLICT` | `apps/api/src/modules/bids/bid.service.test.ts` | `Self-Outbid Prohibition` | `rejects bid from current highest bidder with 409 CONFLICT` |
| **4.7** | Minimum increment: per-crop setting (default 100 poisha) | Configurable | `apps/api/src/modules/bids/bid.service.test.ts` | `Subsequent Bid Increments` | `uses default 100 poisha increment when crop has no minBidIncrementPoisha configured` |

---

## 3. Anti-Sniping Rules Matrix (§6)

| Rule | Requirement | Test File | Test Suite (`describe`) | Test Name (`it`) |
|---|---|---|---|---|
| **6.1** | Remaining time < 2 minutes triggers extension to `now + 2 min` | `apps/api/src/modules/bids/bid.service.test.ts` | `Anti-Sniping Logic` | `extends endsAt to now + 2 minutes when bid arrives with < 2 minutes remaining` |
| **6.2** | Each extension increments `extensionCount` by 1 | `apps/api/src/modules/bids/bid.service.test.ts` | `Anti-Sniping Logic` | `increments extensionCount when anti-sniping extension is triggered` |
| **6.3** | Maximum 5 extensions capped (at most 10 extra minutes total) | `apps/api/src/modules/bids/bid.service.test.ts` | `Anti-Sniping Logic` | `does not extend endsAt beyond 5 extensions cap` |
| **6.4** | Every extension emits `auction.extended` domain event | `apps/api/src/modules/bids/bid.service.test.ts` | `Anti-Sniping Logic` | `emits auction.extended domain event with new endsAt and extension count` |
| **6.5** | Demo mode scales windows down proportionally (15s trigger, 15s ext) | `apps/api/src/modules/bids/bid.service.test.ts` | `Anti-Sniping Logic` | `scales windows down proportionally in demo mode (15 seconds trigger, 15 seconds extension)` |

---

## 4. Concurrency Stress Test Results

- **Test Suite:** `apps/api/src/modules/auctions/concurrency-stress.test.ts`
- **Workload:** 50 concurrent bids executed across 3 separate listings (different crops, varying lot sizes, floor prices, and expiration deadlines) placed by 8 concurrent buyer accounts.
- **Scheduler Simulation:** Injected `TestClock` advanced past expiration milestones, followed by scheduled execution of `closeDueListings()`.
- **Invariants Verified:**
  1. **Listing Final State:** Exactly 2 active listings sold (`ListingStatus.SOLD`) and 1 listing with later expiration remained active.
  2. **Bid Monotonicity & Ordering:** Stored bids had strictly ascending sequence numbers (`1..N`) with zero gaps; the recorded `bidCount` equalled the number of accepted bids.
  3. **Order Consistency:** Exactly 2 unique orders created; buyer ID matched the final winning bidder; order total and unit prices matched winning bid; fee and net matched `calculateFeeAndNet` using `env.PLATFORM_FEE_BPS` (200 bps = 2%).
  4. **Inventory Ledger Conservation:**
     - Farmer's inventory bucket: `availableKg: 0`, `reservedKg: 0`, `soldKg: 850`.
     - Ledger entries: `ADD` (850 kg) → `LIST` (850 kg) → `SELL` (850 kg) with zero divergence.
  5. **Unsold Auction Stock Release:** Listings closing without bids as `EXPIRED_UNSOLD` executed `releaseStock` (`RELEASE`), restoring stock from `reservedKg` back to `availableKg` with zero order created.
- **Flakiness Verification:** Executed 10 consecutive runs in PowerShell loop. **Result:** 10/10 passed with 0 failures and 0 flaky outcomes.

---

## 5. Discrepancy & Consistency Audit

1. **Platform Fee Configuration:**
   - `AUCTION_RULES.md` §8 references platform fee and net calculation. `docs/PRD.md` and `env.ts` define default platform fee as 2% (`PLATFORM_FEE_BPS = 200`). The stress test and closing service adhere strictly to this formula (`floor(subtotal * 200 / 10000)`).
2. **Early Accept Below Floor Validation:**
   - `AUCTION_RULES.md` §9 explicitly mandates that farmer early acceptance is allowed "only if a bid exists and it meets the floor." Prior to this task, `closing.service.ts` had a guard for `NO_BIDS` but lacked an explicit check for `currentBidPerKg < floorPricePerKg`. A unit test was added to verify `400 BELOW_FLOOR` error handling.
3. **Simultaneous Race Rejection Code:**
   - Under atomic conditional updates, simultaneous valid bids race on the database document. The first bid accepted increments the price, and the second bid fails the atomic condition. If the second bid was submitted by a different buyer, it fails with `400 BID_TOO_LOW` (or `409 CONFLICT` if by the same winning buyer). This matches EC1 and Rule 4.6.
