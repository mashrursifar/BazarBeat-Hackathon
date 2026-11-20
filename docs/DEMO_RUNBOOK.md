# Demo Runbook & Rehearsal Guide — BazarBeat

This runbook outlines the operational procedure, rehearsal schedule, presentation script, failure contingencies, and the AI kill-switch procedure for hackathon judging and live demonstrations.

---

## 1. Pre-Demo Checklist (T-30 Minutes)

1. **Verify Cloud Health**:
   Run the preflight suite against the deployed production or staging URL:
   ```bash
   npm run preflight -- --url https://<your-app>.onrender.com
   ```
   Confirm all 9 checks print `[PASS]`, including database latency, live AI grading, and auction closing.

2. **Verify AI Provider & Billing Headroom**:
   - Check Google AI Studio to ensure the project has active billing/credit attached.
   - Confirm `AI_DAILY_ASSESSMENTS_PER_USER=20` (or higher if doing extended demonstrations).
   - Confirm `AI_GRADING_PROVIDER=gemini` (or `mock` if offline).

3. **Verify Demo Accounts**:
   - **Demo Farmer**: `01700000001` / `farmerpassword123`
   - **Demo Buyer**: `01712345678` / `buyerpassword123`
   - Reset demo auctions if needed:
     ```bash
     npm run demo:reset
     ```

---

## 2. Minute-by-Minute Live Presentation Script (5 Minutes)

### Minute 0:00 – 1:00: Problem & The Middleman Trap
- **The Pitch**: In Bangladesh, smallholder farmers lose up to 40% of their harvest value to opaque middleman syndicates (farias/aratdars). They sell without knowing their crop's objective grade or mandi market trends.
- **The Solution**: BazarBeat gives farmers AI-powered quality grading from photos, mandi price guidance, and floor-price protected competitive auctions.

### Minute 1:00 – 2:30: Farmer Journey (Live Quality Grading & Listing)
- Log in as demo farmer (`01700000001`).
- Open **New Listing** wizard.
- Select **Potato** (or Bitter Gourd).
- Show the **Bilingual AI Notice**: *"Photos are analysed by an AI service for quality grading and price guidance. No personal information is shared."*
- Upload curated produce photos.
- Click **Assess quality with AI**:
  - Show the AI assessment result: Grade A badge, agreement-based confidence (e.g. 95% High), and structured reason tags (*Skin intact*, *Uniform size*).
  - Show benchmark wholesale price guidance (Low / Expected / High) computed from market history.
  - Set floor price (e.g. 25.00 BDT/kg) and select 2-minute demo timer.
  - Click **Publish Listing**.

### Minute 2:30 – 3:45: Buyer Journey (Real-Time Bidding Stream)
- In a side-by-side or second browser window, log in as demo buyer (`01712345678`).
- Open the marketplace and find the newly created potato lot.
- Place a competitive bid (e.g. 27.00 BDT/kg).
- Notice the real-time Server-Sent Events (SSE) update: instant countdown timer and bid ticker without page refresh.

### Minute 3:45 – 4:30: Auction Closing & Order Generation
- Watch the 2-minute auction expire.
- Server automatically transitions status from `ACTIVE` to `CLOSED_SOLD`.
- Both farmer and buyer receive instant notification; order is created with reconciled quantities, net farmer earnings, and platform fee.

### Minute 4:30 – 5:00: Q&A & Technical Highlights
- Mention strict architecture: TypeScript strict, integer money in poisha, offline-ready provider adapters, agreement-based confidence across parallel samples, and time-based model evaluation.

---

## 3. Contingency Plan B: Failure Modes & Solutions

| Failure Mode | Symptom | Immediate Solution |
| :--- | :--- | :--- |
| **API Cold Start / Sleeping** | First request takes 30s | Run `npm run preflight` 10 minutes before presentation; keep-warm cron ping (`GET /api/v1/health`) prevents sleeping. |
| **Google Gemini Quota Exhaustion** | 429 Resource Exhausted / Rate limit | Activate **1-Minute Kill Switch** (switch `AI_GRADING_PROVIDER=mock`). Fallback immediately provides instant Grade A demo grading. |
| **Invalid Gemini API Key** | 401 Unauthorized during upload | Preflight detects this upfront. Switch to `mock` or paste valid key into Render dashboard. |
| **Venue Wi-Fi Latency Spike** | Slow photo upload | Use local laptop server (`http://localhost:4000`) with seeded local assets. |
| **Auction Closing Lag** | Timer reaches 0:00 but doesn't close | Background scheduler ticks every 10 seconds. In demo mode, closes within 5–10s automatically. |

---

## 4. 1-Minute Operational AI Kill Switch

If anything goes wrong with the live Gemini API during the demo:

1. Open Render Dashboard -> Your Service -> **Environment**.
2. Change `AI_GRADING_PROVIDER` to `mock`.
3. Click **Save Changes**.
4. Service reloads in ~30 seconds with zero data loss. The mock provider evaluates seeded demo photos instantly with 100% deterministic reliability.
