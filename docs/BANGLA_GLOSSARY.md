# Bangla Glossary (বাংলা পরিভাষা নির্দেশিকা) — BazarBeat

This glossary defines standard, agreed-upon Bangla terms for BazarBeat's domain concepts, ensuring consistent, accessible, and natural phrasing across all user-facing interfaces.

> **Task 8.10 Review Sheet:** The complete human review sheet containing every user-facing string (English vs Bangla) grouped by screen in priority order is documented in [`docs/BANGLA_REVIEW_SHEET.md`](BANGLA_REVIEW_SHEET.md).

---

## 1. Core Marketplace Concepts

| English Term | Bangla Term | Context & Notes |
|---|---|---|
| **Listing** | লিস্টিং / পণ্যের তালিকা | Produce lot offered for auction |
| **New Listing** | নতুন লিস্টিং | Creating an auction lot |
| **Floor Price** | ন্যূনতম দর / ফ্লোর প্রাইস | Minimum opening bid set by the farmer |
| **Bid** | ডাক / বিড | Buyer's price offer per kg |
| **Place Bid** | ডাক দিন / বিড করুন | Action button to submit a bid |
| **Current Bid** | বর্তমান ডাক | Leading price offered so far |
| **Minimum Next Bid** | পরবর্তী ন্যূনতম ডাক | Opening price or current bid + crop minimum increment |
| **Winning** | এগিয়ে আছেন | Current highest bidder status |
| **Outbid** | অন্য ডাক এগিয়ে | Buyer was surpassed by a higher bid |
| **Won** | জয়ী / জিতেছেন | Buyer won the closed auction |
| **Lost** | সমাপ্ত (জয়ী হননি) | Buyer participated but did not win |
| **Auction** | নিলাম | Time-limited competitive crop bidding |
| **Active Auction** | চলমান নিলাম | Auction currently accepting bids |
| **Ending Soon** | শীঘ্রই শেষ হবে | Auction within 15 minutes of closing |
| **Extended** | সময় বৃদ্ধি | Anti-sniping extension triggered |
| **Sold** | বিক্রি হয়েছে | Auction closed meeting or exceeding floor price |
| **Unsold** | বিক্রি ছাড়া সমাপ্ত | Auction closed with no bids |
| **Relist** | পুনরায় তালিকাভুক্ত করুন | Farmer relisting unsold crop with adjusted floor |
| **Compare** | তুলনা করুন | Side-by-side comparison of active produce |
| **Watchlist** | পছন্দের তালিকা | Saved active listings tracked by buyers |
| **Marketplace** | মার্কেটপ্লেস / বাজার | Public buyer produce discovery view |

---

## 2. Quality & AI Guidance

| English Term | Bangla Term | Context & Notes |
|---|---|---|
| **Crop Grade** | ফসলের মান / গ্রেড | Quality tier (Grade A, B, C) |
| **Grade A** | গ্রেড ক (A) | Premium commercial produce |
| **Grade B** | গ্রেড খ (B) | Standard market produce |
| **Grade C** | গ্রেড গ (C) | Fair produce with cosmetic blemishes |
| **AI Assessment** | এআই গুণমান যাচাই | Automated visual quality evaluation |
| **AI Price Guidance** | এআই দর নির্দেশনা | Benchmark price range (Low, Expected, High) |
| **Expected Price** | প্রত্যাশিত দর | Central estimated mandi/bazar price |
| **Market Trend** | বাজারের গতিপ্রকৃতি | Price trajectory (Upward, Stable, Downward) |
| **Confidence** | নির্ভরযোগ্যতা | AI model certainty level |
| **Suggested Floor** | প্রস্তাবিত ন্যূনতম দর | AI recommended floor price protection |

---

## 3. Inventory & Stock Ledger

| English Term | Bangla Term | Context & Notes |
|---|---|---|
| **Inventory** | মজুত / ইনভেন্টরি | Farmer's harvested crop store |
| **Add Stock** | মজুত যোগ করুন | Adding newly harvested crop volume |
| **Available Stock** | বিক্রয়যোগ্য মজুত | Stock uncommitted and ready to list |
| **Listed Stock** | লিস্টিংয়ে সংরক্ষিত | Stock currently reserved in active listings |
| **Sold Stock** | বিক্রিত মজুত | Stock committed to closed sales and orders |
| **Stock Movement** | মজুতের পরিবর্তন | Auditable ledger movements (HARVEST, RESERVE, SELL, RELEASE, RETURN) |

---

## 4. Orders, Payment & Settlement

| English Term | Bangla Term | Context & Notes |
|---|---|---|
| **Order** | অর্ডার | Confirmed purchase contract |
| **Pending** | অপেক্ষমাণ | Awaiting farmer handover confirmation |
| **Confirmed** | নিশ্চিতকৃত | Farmer confirmed schedule; buyer must pay |
| **Delivered** | হস্তান্তর সম্পন্ন | Farmer handed over produce to buyer |
| **Completed** | সমাপ্ত / সম্পন্ন | Order accepted, payment released |
| **Cancelled** | বাতিল | Order terminated before delivery |
| **Disputed** | বিরোধ / সমস্যা রিপোর্ট | Buyer reported quality/quantity discrepancy |
| **Cash on Delivery (COD)** | পণ্য পেয়ে মূল্য পরিশোধ (সিওডি) | Payment on delivery |
| **Simulated Wallet** | ডেমো ওয়ালেট | Digital escrow payment simulation |
| **Handover Schedule** | হস্তান্তর সময়সূচি | Agreed pickup or dispatch date/time |
| **Counterparty** | অপর পক্ষ | Farmer or buyer details |

---

## 5. Sales & Financial Metrics

| English Term | Bangla Term | Context & Notes |
|---|---|---|
| **Sales** | বিক্রয় বিবরণী | Historical booked transactions |
| **Earnings** | উপার্জিত আয় | Net farmer payouts after platform fees |
| **Gross Sales** | মোট বিক্রয়মূল্য | Subtotal before fee deductions |
| **Platform Fee** | প্ল্যাটফর্ম ফি | Platform commission (transparent bps) |
| **Net Settled** | পরিশোধিত নিট আয় | Completed order revenue ready for payout |
| **Price Premium** | বাজারদরের চেয়ে বাড়তি লাভ | Percentage gain over local mandi estimate |
| **Taka (৳)** | টাকা (৳) | Official currency unit |
| **Poisha** | পয়সা | Smallest currency unit (100 poisha = 1 BDT) |
| **Kg** | কেজি | Standard metric mass unit for produce |

---

## 6. System & Navigation

| English Term | Bangla Term | Context & Notes |
|---|---|---|
| **Notifications** | বিজ্ঞপ্তি | Real-time alerts and inbox |
| **Mark all as read** | সবগুলো পঠিত হিসেবে চিহ্নিত করুন | Clear unread alert badges |
| **Settings** | সেটিংস | User profile and preferences |
| **Language** | ভাষা | English / বাংলা switch |
| **Log In** | লগ ইন | User authentication |
| **Create Account** | অ্যাকাউন্ট তৈরি করুন | User registration |
| **Logout** | লগ আউট | Ending session |
