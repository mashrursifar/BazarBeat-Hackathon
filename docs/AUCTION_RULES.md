# Auction Rules — BazarBeat (core feature)

This is the most important document in the repo. Any change here needs human approval (see `AGENTS.md` §7).

## 1. Principles
1. The farmer can never be worse off than selling locally: the floor price is respected or the lot is not sold.
2. The server is the only authority on time, ordering, and winners.
3. Bids are binding, per kg, for the whole lot.
4. Every outcome is deterministic and reproducible from stored data.

## 2. Listing creation rules
- Crop must be active; quantity within the crop's min/max lot limits and within the farmer's available stock.
- 1–4 images; a valid assessment token from the AI grading step (grade cannot be chosen or raised by the farmer).
- Floor price: integer poisha per kg, greater than zero. If it is more than 30% above the AI "high" price, show a warning that it may not sell (warn, do not block). If it is below the AI "low" price, warn that it is below market.
- Duration presets: 1h, 3h, 6h, 12h, 24h. Maximum duration is capped by the crop's shelf-life setting. Demo mode adds a 2-minute preset.
- On publish: stock moves from available to listed (ledger entry LIST), status becomes ACTIVE, `startsAt = now`, `endsAt = now + duration`, `originalEndsAt = endsAt`.

## 3. Pricing guidance shown to the farmer
- Show the AI low / expected / high range, trend, and the **Local market estimate** (the fallback if nothing sells).
- Suggested floor = expected local price, adjusted for the farmer's optional "cost to sell locally" (transport, commission), plus a small premium. The farmer can edit freely.
- Explain in plain words: "If no bid reaches your floor, you can still sell in your local market."

## 4. Bid validation (all must pass, checked atomically)
| Rule | Error code |
|---|---|
| Actor is a BUYER and not the listing's farmer | FORBIDDEN / OWN_LISTING |
| Listing status is ACTIVE and server time < endsAt | AUCTION_CLOSED |
| If no bids yet: amount ≥ floor price | BID_TOO_LOW |
| If bids exist: amount ≥ current highest + minimum increment | BID_TOO_LOW |
| Amount is a positive integer poisha | VALIDATION_ERROR |
| The buyer is not already the current highest bidder (cannot outbid self) | CONFLICT |
Minimum increment: per-crop setting in the catalog (default ৳1.00 per kg = 100 poisha).

## 5. Atomic bid acceptance
Accepting a bid is one conditional update on the listing: it succeeds only if the listing is still ACTIVE, not past `endsAt`, and the stored current bid is still below the new amount (or no bid exists and the amount meets the floor). On success, the same operation updates current bid, bidder, and bid count. If the condition fails, the service reports the specific reason by re-reading state. The bid record is then appended. If appending fails after a successful update, a compensating step must restore consistency and log an alert. Concurrency tests (parallel bids) are mandatory.

## 6. Anti-sniping
If a bid is accepted when remaining time is under 2 minutes, `endsAt` becomes `now + 2 minutes`, `extensionCount` increases by one. Maximum 5 extensions (so at most 10 extra minutes). Every extension emits `auction.extended` with the new end time. Demo mode scales the windows down proportionally (e.g. 15 seconds).

## 7. Listing state machine
```
DRAFT ──publish──> ACTIVE ──timer ends, winning bid ≥ floor──> SOLD
                     │ ├──timer ends, no qualifying bid──> EXPIRED_UNSOLD
                     │ ├──farmer cancels (no bids)──> CANCELLED
                     │ └──farmer accepts current bid (≥ floor)──> SOLD
```
Terminal states: SOLD, EXPIRED_UNSOLD, CANCELLED. No transition out of a terminal state (relisting creates a new listing). Only the auction service performs transitions.

## 8. Closing procedure (idempotent)
Runs from the scheduler or from "accept now".
1. Atomically transition ACTIVE → closing outcome only if status is still ACTIVE and `endsAt` has passed (or farmer accept). A second run finds nothing to do.
2. If SOLD: mark winning bid WON and the others LOST; create the Order (unique per listing) with price snapshot, fee, and farmer net; move stock from listed to sold (ledger SELL); emit `auction.closed` and `order.created`.
3. If EXPIRED_UNSOLD: move stock from listed back to available (ledger RELEASE); emit `auction.closed`.
4. Emit notifications via events only.
5. Record a MarketPrice row (source PLATFORM) when sold.

## 9. Farmer controls
- **Cancel:** only with zero bids. With bids, return HAS_BIDS.
- **Accept current bid early:** only if a bid exists and it meets the floor.
- **Edit:** listings cannot be edited after publish (protects bidders). Cancel and recreate if no bids.
- **Unsold:** show "Not sold — sell at your local market, or relist" with relist pre-filled (same crop, quantity, suggested new floor).

## 10. Bidder privacy and fairness
Bidders appear as anonymized labels (e.g. "Buyer #3") to everyone except the order participants after confirmation. The farmer sees amounts and times, not identities.

## 11. Order state machine
```
PENDING ──farmer confirms──> CONFIRMED ──mark delivered──> DELIVERED ──buyer completes──> COMPLETED
   │                           │                               │
   └──cancel (either)──> CANCELLED      └──cancel (before delivery)──> CANCELLED     └──dispute──> DISPUTED
```
- **Lifecycle & Transitions:** PENDING orders require farmer confirmation with a valid handover schedule (`handoverAt` between now and +72 hours ahead). Confirmed orders are marked delivered by the farmer, then completed by the buyer upon receipt. Buyers can raise a dispute (`DELIVERED → DISPUTED`) within 24 hours of delivery. Either party may cancel while in PENDING or CONFIRMED (prior to delivery).
- **Payment Independence:** Payment status (`UNPAID → PAID`) is independent of delivery status. Supports simulated in-app wallet (`WALLET_SIM`) or cash-on-delivery (`COD`) settled upon delivery.
- **Counterparty Privacy:** Sensitive contact details (phone number, detailed address) are strictly masked during `PENDING`. Only after farmer confirmation are contact details revealed to the verified counterparty.
- **Lifecycle Timers:** Unconfirmed `PENDING` orders auto-cancel after 12 hours (scaled to 1 minute in demo mode: `DEMO_ORDER_AUTO_CANCEL_MS = 60_000`). Unreviewed `DELIVERED` orders auto-complete after 24 hours (scaled to 2 minutes in demo mode: `DEMO_ORDER_AUTO_COMPLETE_MS = 120_000`) if no dispute is raised.
- **Stock Return on Cancellation:** Cancelling an order presents the farmer with a one-time stock return prompt. Choosing `RETURNED` restores the lot quantity to available inventory with a `RETURN` ledger movement; choosing `DISCARDED` retains current inventory if produce was damaged or sold locally elsewhere.
- **Role Isolation:** Strict role-based access control guarantees farmers cannot act as buyers (or bid on their own listings), and buyers cannot perform farmer actions (confirmation, marking delivered, stock return).

## 12. Edge cases that must have tests
- Two simultaneous valid bids: exactly one wins the ordering; the other is rejected with BID_TOO_LOW.
- Bid at the exact `endsAt` boundary.
- Late bid triggers extension; sixth extension is not applied.
- Bid below floor on first bid; bid below increment later.
- Closing runs twice; only one order exists.
- Farmer tries to cancel with a bid; farmer accepts early below floor.
- A farmer attempts to bid on their own listing; a buyer attempts to outbid themselves.
- Clock skew: client countdown reaches zero before the server closes; UI shows "Finalizing…" until the server event arrives.
