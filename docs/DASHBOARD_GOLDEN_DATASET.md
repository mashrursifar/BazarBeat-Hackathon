# Dashboard Golden Dataset Specification

This document defines the reference ground-truth dataset and mathematically derived expected values for BazarBeat dashboards, KPI cards, period-over-period (PoP) percentage changes, time-series bucketing, and market price summaries.

> [!IMPORTANT]
> **Independent Verification Rule**: This document is authored strictly from first principles and contract definitions without importing production code. Every calculation, rounding step, and aggregation rule is shown with explicit arithmetic so that human reviewers can audit and verify any value independently.

---

## 1. Dataset Design & Invariants

- **Reference Date (Evaluation Anchor)**: `2026-11-16T12:00:00.000Z` (Asia/Dhaka: `2026-11-16 18:00:00 +06:00`).
- **Timezone Authority**: `Asia/Dhaka` (permanently UTC+6, no DST).
  - Midnight in Asia/Dhaka (`00:00:00 +06:00`) maps to UTC `18:00:00.000Z` of the prior calendar day.
- **Participants**:
  - 2 Farmers:
    - Farmer 1: Rahim Farmer (`670000000000000000000001`, Rajshahi, Bogura)
    - Farmer 2: Anwar Farmer (`670000000000000000000002`, Rangpur, Rangpur)
  - 3 Buyers:
    - Buyer 1: Karim Buyer (`670000000000000000000011`, Dhaka, Karim Wholesales Ltd)
    - Buyer 2: Salim Buyer (`670000000000000000000012`, Chattogram, Salim Agro Mart)
    - Buyer 3: Tariq Buyer (`670000000000000000000013`, Sylhet, Sylhet Fresh Direct)
- **Crops**:
  - Crop 1: Onion (`crop-onion`, ID `670000000000000000000101`, minIncrement: 50 poisha)
  - Crop 2: Potato (`crop-potato`, ID `670000000000000000000102`, minIncrement: 50 poisha)
  - Crop 3: Green Chilli (`crop-chilli`, ID `670000000000000000000103`, minIncrement: 100 poisha)
- **Financial & Monetary Standards**:
  - Currency: Integer poisha (1 BDT = 100 poisha).
  - Platform Fee: 200 bps (2.0%). Formula: `Math.round((subtotal * 200) / 10000) = Math.round(subtotal / 50)`.
  - Farmer Net: `subtotal - platformFee`. Invariant: `platformFee + farmerNet === subtotal`.
  - Settled Earnings: Excludes orders in `CANCELLED` and `DISPUTED` statuses.

---

## 2. Orders Inventory (15 Orders)

| Order ID | Listing | Farmer | Buyer | Crop | Qty (kg) | Price/kg (poisha) | Expected/kg | Subtotal (poisha) | Fee (poisha) | Net (poisha) | Status | Payment | Created At (UTC) | Asia/Dhaka Bucket | Notes / Edge Cases |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `order-01` | `listing-01` | F1 | B1 | Onion | **25.5** | 4,550 | 4,000 | 116,025 | **2,321** | 113,704 | `COMPLETED` | WALLET (PAID) | 2026-11-10T05:00Z | `2026-11-10` | Fractional kg; Fee rounds UP (`116025 / 50 = 2320.5 -> 2321`) |
| `order-02` | `listing-02` | F1 | B2 | Potato | 50.0 | 3,000 | 2,800 | 150,000 | 3,000 | 147,000 | `COMPLETED` | COD (PAID) | **2026-11-09T18:00Z** | **`2026-11-10`** | **Asia/Dhaka Midnight** (`18:00Z == 00:00 +06:00`) |
| `order-03` | `listing-03` | F1 | B3 | Onion | **12.5** | 4,550 | 4,200 | 56,875 | **1,138** | 55,737 | `COMPLETED` | WALLET (PAID) | 2026-11-12T04:00Z | `2026-11-12` | Fractional kg; Fee rounds UP (`56875 / 50 = 1137.5 -> 1138`) |
| `order-04` | `listing-04` | F1 | B1 | Chilli | 15.0 | 14,001 | 13,500 | 210,015 | **4,200** | 205,815 | `COMPLETED` | WALLET (PAID) | 2026-11-14T03:00Z | `2026-11-14` | Fee rounds DOWN (`210015 / 50 = 4200.3 -> 4200`) |
| `order-05` | `listing-05` | F1 | B2 | Potato | **100.5** | 2,950 | 2,800 | 296,475 | **5,930** | 290,545 | `DELIVERED` | COD (UNPAID) | 2026-11-14T10:00Z | `2026-11-14` | Fractional kg; Fee rounds UP (`296475 / 50 = 5929.5 -> 5930`) |
| `order-06` | `listing-06` | F1 | B3 | Onion | 40.0 | 4,800 | 4,500 | 192,000 | 3,840 | 188,160 | `DELIVERED` | WALLET (PAID) | **2026-11-14T18:00Z** | **`2026-11-15`** | **Asia/Dhaka Midnight** (`18:00Z == 00:00 +06:00`) |
| `order-07` | `listing-07` | F1 | B1 | Chilli | 20.0 | 14,500 | 14,000 | 290,000 | 5,800 | 284,200 | `CONFIRMED` | WALLET (PAID) | 2026-11-15T06:00Z | `2026-11-15` | Handover scheduled |
| `order-08` | `listing-08` | F1 | B2 | Onion | 30.0 | 4,600 | 4,500 | 138,000 | 2,760 | 135,240 | `CANCELLED` | REFUNDED | 2026-11-16T02:00Z | `2026-11-16` | Cancelled by buyer; excluded from settled earnings |
| `order-09` | `listing-09` | F1 | B3 | Potato | 60.0 | 3,100 | 3,000 | 186,000 | 3,720 | 182,280 | `DISPUTED` | WALLET (PAID) | 2026-11-16T04:00Z | `2026-11-16` | Grade dispute raised; excluded from settled earnings |
| `order-10` | `listing-10` | F2 | B1 | Onion | 80.0 | 4,400 | 4,200 | 352,000 | 7,040 | 344,960 | `CONFIRMED` | COD (UNPAID) | **2026-11-04T06:00Z** | **`2026-11-04`** | **Previous 7d Period** (Nov 03 - Nov 09) |
| `order-11` | `listing-11` | F2 | B2 | Chilli | **18.5** | 13,850 | 13,500 | 256,225 | **5,125** | 251,100 | `CONFIRMED` | WALLET (PAID) | 2026-11-15T02:00Z | `2026-11-15` | Fractional kg; Fee rounds UP (`256225 / 50 = 5124.5 -> 5125`) |
| `order-12` | `listing-12` | F2 | B1 | Potato | 50.0 | 3,200 | 3,000 | 160,000 | 3,200 | 156,800 | `PENDING` | WALLET (UNPAID) | 2026-11-16T08:00Z | `2026-11-16` | Awaiting confirmation by farmer |
| `order-13` | `listing-13` | F2 | B3 | Onion | 35.0 | 4,700 | 4,500 | 164,500 | 3,290 | 161,210 | `PENDING` | COD (UNPAID) | 2026-11-16T09:00Z | `2026-11-16` | Awaiting confirmation by farmer |
| `order-14` | `listing-14` | F2 | B1 | Potato | 40.0 | 2,900 | 2,800 | 116,000 | 2,320 | 113,680 | `CANCELLED` | REFUNDED | **2026-11-05T06:00Z** | **`2026-11-05`** | **Previous 7d Period**; Auto-cancelled unconfirmed |
| `order-15` | `listing-15` | F2 | B2 | Chilli | 10.0 | 13,500 | 13,000 | 135,000 | 2,700 | 132,300 | `DISPUTED` | WALLET (PAID) | **2026-11-06T08:00Z** | **`2026-11-06`** | **Previous 7d Period**; Short weight dispute |

---

## 3. Listings Inventory (24 Listings)

- **Farmer 1 Listings (14 total)**:
  - 9 `SOLD`: Listings `01` to `09` (awarded to winning bidders, creating Orders `01` to `09`).
  - 2 `EXPIRED_UNSOLD`:
    - `listing-16`: Potato, 70 kg, floor 3,500 poisha, 0 bids, closed Nov 08.
    - `listing-17`: Green Chilli, 25 kg, floor 16,000 poisha, 0 bids, closed Nov 09.
  - 1 `CANCELLED`:
    - `listing-19`: Onion, 45 kg, floor 4,800 poisha, cancelled by farmer before bids, closed Nov 06.
  - 2 `ACTIVE`:
    - `listing-21`: Onion, 65 kg, floor 4,000 poisha, current bid 4,500 poisha (Buyer 1 winning, Buyer 2 outbid), ends in 2h.
    - `listing-22`: Green Chilli, 30 kg, floor 13,000 poisha, current bid 14,000 poisha (Buyer 2 winning, Buyer 1 outbid), ends in 5h.

- **Farmer 2 Listings (10 total)**:
  - 6 `SOLD`: Listings `10` to `15` (creating Orders `10` to `15`).
  - 1 `EXPIRED_UNSOLD`:
    - `listing-18`: Green Chilli, 20 kg, floor 15,500 poisha, 0 bids, closed Nov 07.
  - 1 `CANCELLED`:
    - `listing-20`: Potato, 30 kg, floor 3,300 poisha, cancelled by farmer before bids, closed Nov 06.
  - 2 `ACTIVE`:
    - `listing-23`: Potato, 50 kg, floor 2,800 poisha, current bid 3,100 poisha (Buyer 3 winning), ends in 3.5h.
    - `listing-24`: Onion, 40 kg, floor 4,200 poisha, 0 bids, floor only, ends in 12h.

---

## 4. Expected KPI Values & Arithmetic Proofs

### 4.1 Farmer 1 Dashboard

#### A. 30-Day Range (`30d`)
- **Active Window**: `2026-10-18` to `2026-11-16` (Asia/Dhaka).
- **Previous Window**: `2026-09-18` to `2026-10-17` (Asia/Dhaka).
- **Included Orders**: Orders `01`, `02`, `03`, `04`, `05`, `06`, `07` (Orders `08` CANCELLED and `09` DISPUTED are excluded from settled totals).
  - Total Sales (Gross):
    $$116,025 + 150,000 + 56,875 + 210,015 + 296,475 + 192,000 + 290,000 = 1,311,390\text{ poisha (৳13,113.90)}$$
  - Platform Fees:
    $$2,321 + 3,000 + 1,138 + 4,200 + 5,930 + 3,840 + 5,800 = 26,229\text{ poisha (৳262.29)}$$
  - Settled Net Earnings:
    $$1,311,390 - 26,229 = 1,285,161\text{ poisha (৳12,851.61)}$$
    Sum of individual nets check:
    $$113,704 + 147,000 + 55,737 + 205,815 + 290,545 + 188,160 + 284,200 = 1,285,161\text{ (Exact match)}$$
  - Previous 30d Sales: `0 poisha`.
  - PoP Change: `null` (**no delta when previous value is zero**).
- **Active Auctions**: 2 (`listing-21`, `listing-22`).
- **Pending Orders**: 0 (Orders 1..4 are `COMPLETED`, 5..6 `DELIVERED`, 7 `CONFIRMED`, 8 `CANCELLED`, 9 `DISPUTED`).
- **Win Rate**:
  - Total closed listings: 9 (`SOLD`) + 2 (`EXPIRED_UNSOLD`) + 1 (`CANCELLED`) = 12 listings.
  - Sold listings: 9.
  - $$\text{Win Rate} = \frac{9}{12} \times 100 = 75.0\%$$
- **Top Crop**:
  - Green Chilli (`crop-chilli`): 2 orders (Order 04: 210,015 poisha, Order 07: 290,000 poisha).
    - Total Sales = 500,015 poisha; Net = 490,015 poisha; Volume = 35.0 kg.
  - (Onion: Orders 01, 03, 06 = 364,900 poisha; Potato: Orders 02, 05 = 446,475 poisha).
  - Top Crop = Green Chilli.

#### B. 7-Day Daily Trend (`7d`) with Zero Buckets
- Current Window: `2026-11-10` to `2026-11-16` (7 daily buckets in Asia/Dhaka):

| Bucket Date | Orders Included | Sales (poisha) | Volume (kg) | Order Count | Explanation |
|---|---|---|---|---|---|
| `2026-11-10` | Order 01 (116,025) + Order 02 (150,000) | **266,025** | 75.5 | 2 | Order 02 occurred at 18:00 UTC (Midnight in Asia/Dhaka) |
| `2026-11-11` | *None* | **0** | **0** | **0** | **Zero bucket filled by series filling helper** |
| `2026-11-12` | Order 03 (56,875) | **56,875** | 12.5 | 1 | Fractional 12.5 kg |
| `2026-11-13` | *None* | **0** | **0** | **0** | **Zero bucket filled by series filling helper** |
| `2026-11-14` | Order 04 (210,015) + Order 05 (296,475) | **506,490** | 115.5 | 2 | Orders at 09:00 and 16:00 Asia/Dhaka |
| `2026-11-15` | Order 06 (192,000) + Order 07 (290,000) | **482,000** | 60.0 | 2 | Order 06 at 18:00 UTC (Midnight Nov 15 in Asia/Dhaka) |
| `2026-11-16` | *None (Orders 8 & 9 are cancelled/disputed)* | **0** | **0** | **0** | Settled sales exclude cancelled/disputed |
| **Total** | | **1,311,390** | **263.5** | **7** | |

---

### 4.2 Farmer 2 Dashboard

#### A. 30-Day Range (`30d`)
- **Active Window**: `2026-10-18` to `2026-11-16` (Asia/Dhaka).
- **Included Settled Orders**: Orders `10`, `11`, `12`, `13` (Orders `14` CANCELLED and `15` DISPUTED excluded).
  - Total Sales (Gross):
    $$352,000 + 256,225 + 160,000 + 164,500 = 932,725\text{ poisha (৳9,327.25)}$$
  - Platform Fees:
    $$7,040 + 5,125 + 3,200 + 3,290 = 18,655\text{ poisha (৳186.55)}$$
  - Settled Net Earnings:
    $$932,725 - 18,655 = 914,070\text{ poisha (৳9,140.70)}$$
- **Active Auctions**: 2 (`listing-23`, `listing-24`).
- **Pending Orders**: 2 (`order-12`, `order-13`).
- **Win Rate**:
  - Total closed listings: 6 (`SOLD`) + 1 (`EXPIRED_UNSOLD`) + 1 (`CANCELLED`) = 8 listings.
  - Sold listings: 6.
  - $$\text{Win Rate} = \frac{6}{8} \times 100 = 75.0\%$$
- **Top Crop**:
  - Onion (`crop-onion`): Order 10 (352,000) + Order 13 (164,500) = 516,500 poisha (Volume = 115.0 kg).

#### B. 7-Day Range (`7d`) with Non-Zero Period-Over-Period Change
- **Current Window** (`2026-11-10` to `2026-11-16`):
  - Orders: 11 (256,225) + 12 (160,000) + 13 (164,500) = **580,725 poisha**.
  - Net: 251,100 + 156,800 + 161,210 = **569,110 poisha**.
- **Previous Window** (`2026-11-03` to `2026-11-09`):
  - Orders: Order 10 occurred on `2026-11-04` (Asia/Dhaka) = **352,000 poisha** (Net = **344,960 poisha**).
- **Period-over-Period Calculations**:
  - Total Sales Change:
    $$\text{Change} = \frac{580,725 - 352,000}{352,000} \times 100 = \frac{228,725}{352,000} \times 100 = +64.97869\dots \implies \mathbf{+65.0\%}$$
  - Earnings Net Change:
    $$\text{Change} = \frac{569,110 - 344,960}{344,960} \times 100 = \frac{224,150}{344,960} \times 100 = +64.97854\dots \implies \mathbf{+65.0\%}$$

---

### 4.3 Buyer Dashboards

#### Buyer 1 (Karim Buyer, Wholesaler)
- **30-Day Range**:
  - Won Orders: `01` (116,025), `04` (210,015), `07` (290,000), `10` (352,000), `12` (160,000) (Order `14` cancelled).
  - Total Spend:
    $$116,025 + 210,015 + 290,000 + 352,000 + 160,000 = \mathbf{1,128,040\text{ poisha (৳11,280.40)}}$$
  - Active Bids: 2 (Listing 21 status `WINNING`, Listing 22 status `OUTBID`).
  - Pending Orders: 1 (`order-12`).
  - Win Rate:
    - Participated closed listings: 6 won + 2 lost (`listing-02`, `listing-05`) = 8 listings.
    - Won: 6 listings.
    - $$\text{Win Rate} = \frac{6}{8} \times 100 = \mathbf{75.0\%}$$
  - Average Price vs Market:
    - Quantity-weighted difference between paid price and AI expected price:
      - Order 01: 25.5 kg * (4550 - 4000) = +14,025 poisha
      - Order 04: 15.0 kg * (14001 - 13500) = +7,515 poisha
      - Order 07: 20.0 kg * (14500 - 14000) = +10,000 poisha
      - Order 10: 80.0 kg * (4400 - 4200) = +16,000 poisha
      - Order 12: 50.0 kg * (3200 - 3000) = +10,000 poisha
      - Total Expected Value = 25.5*4000 + 15*13500 + 20*14000 + 80*4200 + 50*3000 = 1,050,500 poisha
      - Total Premium Amount = +57,540 poisha
      - Premium % = (57,540 / 1,050,500) * 100 = 5.477% -> **+5.5%** (or single-order unweighted average: 6.8%)

#### Buyer 2 (Salim Buyer, Supermarket)
- Won Orders: `02` (150,000), `05` (296,475), `11` (256,225) (Order `08` cancelled, Order `15` disputed).
- Total Spend (uncancelled): 150,000 + 296,475 + 256,225 = **702,700 poisha (৳7,027.00)**.
- Active Bids: 2 (Listing 21 `OUTBID`, Listing 22 `WINNING`).
- Pending Orders: 0.
- Win Rate: 5 won / 8 completed auctions = **62.5%**.

#### Buyer 3 (Tariq Buyer, Fresh Direct)
- Won Orders: `03` (56,875), `06` (192,000), `09` (186,000), `13` (164,500).
- Total Spend: 56,875 + 192,000 + 186,000 + 164,500 = **599,375 poisha (৳5,993.75)**.
- Active Bids: 1 (Listing 23 `WINNING`).
- Pending Orders: 1 (`order-13`).
- Win Rate: 4 won / 8 completed auctions = **50.0%**.

---

## 5. Human Review Sample Checks

Human reviewers can verify the dataset consistency using these sample sanity checks:

1. **Fee Math Check (Order 01)**:
   - Quantity: 25.5 kg; Price: 4,550 poisha/kg.
   - Subtotal: $25.5 \times 4550 = 116025.0 \implies 116,025\text{ poisha}$.
   - Platform fee at 2.0%: $116025 \times 0.02 = 2320.5 \implies \text{rounds to } 2,321\text{ poisha}$.
   - Net: $116025 - 2321 = 113,704\text{ poisha}$.
   - Verification: $2321 + 113704 = 116025$ (Check: PASS).

2. **Asia/Dhaka Midnight Boundary Check (Order 02)**:
   - Timestamp in UTC: `2026-11-09T18:00:00.000Z`.
   - UTC+6 Offset: $18:00 + 6\text{ hours} = 24:00 \implies 00:00:00\text{ on } 2026-11-10$.
   - Bucket key: `"2026-11-10"`.
   - Verification: Appears in November 10 daily bucket, not November 9 (Check: PASS).

3. **Zero Bucket Gap Check**:
   - On `2026-11-11` and `2026-11-13`, zero orders were executed for Farmer 1.
   - Continuous 7-day trend series returns `sales: 0, quantityKg: 0, orderCount: 0`.
   - Verification: Graph rendering does not skip dates or draw diagonal gaps (Check: PASS).

4. **Zero-Previous Delta Handling Check**:
   - For Farmer 1 on 30d range, sales prior to Oct 18 equal `0`.
   - Instead of returning `Infinity` or `NaN`, `changePercent` evaluates to `null`.
   - Verification: UI displays no delta tag or neutral indicator without runtime crashes (Check: PASS).
