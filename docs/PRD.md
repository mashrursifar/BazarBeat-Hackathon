# Product Requirements — BazarBeat

## 1. Problem
Rural farmers often sell perishable produce to local middlemen or at the nearest market at whatever price is offered. They lack visibility into prices elsewhere, cannot prove their crop quality, and have no leverage.

## 2. Solution
A marketplace where farmers list produce with AI-verified quality and a floor price, and buyers nationwide bid within a time window. The farmer's downside is zero: if the floor is not met, they sell locally as before.

## 3. Goals and non-goals
**Goals:** better prices for farmers; trusted quality signal for buyers; transparent competitive bidding; a smooth, mobile-friendly experience for low-tech users.
**Non-goals (MVP):** real payment processing, logistics/delivery routing, more than 5 crops, chat between users, partial-lot purchases, multi-language beyond English and Bangla, admin back-office beyond seed data.

## 4. Personas
- **Farmer (Rahim):** smallholder, Android phone, limited English, wants a simple flow and a price he trusts.
- **Buyer (Karim):** wholesaler/retailer/restaurant purchaser in a city, wants reliable quality and volume, compares multiple sources.

## 5. Glossary
| Term | Meaning |
|---|---|
| Listing | A farmer's offer of one lot of one crop, with photos, AI grade, floor price, and auction window |
| Lot | The quantity (kg) offered in one listing; sold whole |
| Floor price | Minimum price per kg the farmer will accept; also the opening bid level |
| Bid | A buyer's binding offer in BDT per kg |
| Local market estimate | AI-predicted price the farmer would likely get locally; their fallback |
| Grade | AI quality class: A (best), B, C |
| Award | Auction closes with a winning bid ≥ floor |
| Win rate | Percentage of auctions won or sold. For a farmer: sold listings divided by total closed listings (`sold / (sold + expiredUnsold + cancelled) * 100`). For a buyer: won listings divided by total completed listings bid on (`won / (won + lost) * 100`) |
| Booked Sales | Total gross value of won auction orders in the selected period, excluding CANCELLED orders |
| Booked Spend | Total purchase spend by a buyer across won orders in the selected period, excluding CANCELLED orders |
| Settled Earnings | Farmer's actual net earnings (`subtotal - platformFee`) on COMPLETED orders, excluding CANCELLED and DISPUTED |
| Expected Earnings | Farmer's projected net earnings across in-progress orders (`PENDING`, `CONFIRMED`, `DELIVERED`) |
| Price Premium | Quantity-weighted percentage difference between winning auction price and AI benchmark price estimate at listing time |
| Active Auctions / Bids | Auctions currently in ACTIVE status accepting bids; bids placed on active auctions partitioned into winning and outbid states |
| Period-over-period (PoP) change | Percentage change in a KPI comparing the current time window against the immediately preceding period of equal duration (`((current - previous) / previous) * 100`). Defined as null (no delta) when the previous period's value is zero |
| Range presets & buckets | Standardized time windows (`7d`, `30d`, `90d`, `1y`, `all`) mapped to daily or monthly time-series buckets strictly aligned to `Asia/Dhaka` calendar boundaries, with zero-filling for missing activity dates |
| Market summary & National summary | Aggregated benchmark prices (average, min, max) and price trend across crops and Bangladesh divisions |

## 6. Farmer features
| ID | Priority | Feature |
|---|---|---|
| F-01 | P0 | Register/login as farmer with name, phone, division, district, upazila |
| F-02 | P0 | Dashboard: total sales, earnings, active auctions, pending orders, sales trend chart, top crop, win rate (auctions sold vs. total) |
| F-03 | P0 | Create listing wizard: choose crop → upload 1–4 photos → AI grade → AI price guidance → set quantity, floor price, auction duration → review → publish |
| F-04 | P0 | Crop Bidding page: live auctions with countdown, current highest bid, bid count, live updates |
| F-05 | P0 | Early actions: cancel (only if no bids), accept current highest bid early (only if ≥ floor) |
| F-06 | P0 | Unsold handling: expired listing shows "Not sold — sell locally or relist" with one-tap relist |
| F-07 | P0 | Inventory: stock per crop (available / listed / sold), manual stock add, movement history |
| F-08 | P0 | Orders: incoming orders from won auctions, confirm, mark ready/handed over |
| F-09 | P1 | Sales: history table with filters (crop, date, buyer region) |
| F-10 | P1 | Earnings: totals, per-crop breakdown, payout status (simulated), fee display |
| F-11 | P1 | Market Prices: AI price trend per crop and region so farmers learn the market |
| F-12 | P1 | Notifications: new bid, outbid is N/A, auction ending, auction result, order updates |
| F-13 | P2 | Bangla UI toggle (structure for i18n from day one) |
| F-14 | P2 | "Buy Now" price on listings |

## 7. Buyer features
| ID | Priority | Feature |
|---|---|---|
| B-01 | P0 | Register/login as buyer with name, phone, organization (optional), division, district |
| B-02 | P0 | Marketplace: all active listings nationwide; filters (crop, grade, division/district, price range, ends soon, quantity); sort (ending soonest, lowest price, highest grade, newest) |
| B-03 | P0 | Listing detail: photos, AI grade + confidence, AI market range, quantity, farmer's district, countdown, bid history (anonymized bidders), place bid |
| B-04 | P0 | Compare: pick up to 4 listings and view side by side (crop, grade, price per kg, current bid, total cost, region, time left); highlight the best value |
| B-05 | P0 | Bidding: place bid, see instant validation, see outbid status, live updates |
| B-06 | P0 | My Bids: active (winning/outbid), won, lost |
| B-07 | P0 | Orders: won auctions become orders; track status; confirm receipt |
| B-08 | P0 | Dashboard: total spend, active bids, win rate, average price paid vs. market, purchases by crop, spend trend |
| B-09 | P1 | Watchlist: save listings; notification when ending soon |
| B-10 | P1 | National price map/table: average listing price per crop per division |
| B-11 | P1 | Dispute: raise a grade dispute within a window after delivery |

## 8. Core user journeys (acceptance anchors)
- **J1 Farmer lists:** wizard completes in under 2 minutes; grade and price guidance appear within 5 seconds; listing appears in the marketplace immediately.
- **J2 Buyer bids:** buyer finds listing via filters, compares 2–3 listings, places a valid bid; other viewers see the new price live.
- **J3 Auction sold:** timer ends, highest bid ≥ floor wins, order is created, both parties are notified, inventory reflects the sale.
- **J4 Auction unsold:** timer ends with no qualifying bid, listing is marked unsold, stock is released, farmer sees the relist prompt.
- **J5 Anti-sniping:** late bid extends the timer within the cap.

## 9. Business rules summary
Detailed in `AUCTION_RULES.md`. Key points: floor is visible and is the opening price; bids are binding, per kg, whole-lot only; server decides time; farmer cannot bid on own listing; AI grade cannot be raised by the farmer.

## 10. Success metrics (for the demo and pitch)
- Median price premium of winning bids over the AI local-market estimate
- Time from photo to published listing
- Auction fill rate (listings that sold)
- Bids per listing

## 11. Constraints
- Hackathon timeline: prioritize P0, then P1; P2 only if time remains
- Must run end-to-end with seeded data and mock AI (no external dependency required)
- Low-bandwidth friendliness: compress images client-side before upload

## 12. Open questions
Tracked in `DECISIONS.md` (payment simulation, real AI model source, delivery responsibility).
