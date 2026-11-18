# Phase 8 prompts — Notifications, watchlist, Bangla and polish (P1)

Everything in this phase is P1 or P2, but it is what makes the product feel alive and usable for farmers: live alerts, a Bangla interface, and a clean mobile experience. Run each task in a fresh conversation, read the agent's plan before it codes, and commit after each task.

## Before you start
- Phase 7 acceptance passes (dashboards, market pages, history seeder).
- Find a Bangla speaker who can review translations (Task 8.10). Ask them now so they have time.

## Cut line (what to do first if time is short)
1. Notifications: 8.1, 8.2, 8.3, 8.4, 8.6
2. Bangla: 8.8, 8.9, 8.10
3. Accessibility and mobile pass: 8.11
4. Watchlist: 8.5, 8.7
5. Optional polish (P2): 8.12
6. Phase wrap-up: 8.13 (always)

## Gaps this phase must close
1. **Notification text cannot be both stored and translated.** `DATA_MODEL.md` stores `title` and `body`, which would freeze one language. Decision (D-32): store `type` plus structured `params` (crop slug, amounts in poisha, listing ID, order ID, order sub-event) and render the text on the client from i18n keys. Also keep an English `title` and `body` as a fallback only. Params never contain another user's identity or contact details.
2. **Who gets which notification is not specified.** The matrix below is the contract. The `bid.placed` event must carry the previous highest bidder's ID so the outbid buyer can be notified (internal only: confirm the Phase 4.7 listing stream never forwards it).
3. **Notifications can spam or duplicate.** Decision (D-33): every notification has a `dedupeKey` with a unique index per user, so repeated events create one notification. Unread NEW_BID notifications for the same listing are coalesced into one with a count and the latest amount. ENDING_SOON is sent once per listing per user. Never notify the user who caused the event. Retention: documents expire after 60 days (TTL index).
4. **Subscribers must never break the main action.** Notification creation runs after the action succeeds, asynchronously, with errors logged and swallowed. A failing subscriber must not fail a bid or an auction close.
5. **Two kinds of live streams per tab.** The bell opens `/me/stream` in addition to the listing stream on detail pages. Set the per-user cap high enough for this (for example 6) and make the server drop the oldest stream instead of rejecting a new one. The unread count must also work by polling every 30 seconds (the list endpoint returns `meta.unreadCount`; no extra endpoint).
6. **Duplicate toasts.** The farmer's Crop Bidding page already toasts new bids from the listing stream. Rule: a notification toast is suppressed when the user is currently viewing the notification's listing or order; the bell still updates. Updates to a coalesced notification never re-toast.
7. **Watchlist and visibility conflict.** Phase 5.3 lets buyers open only ACTIVE listings or listings they bid on, so a watched listing would break once it ends. Decision (D-34): buyers may also open ended listings in their watchlist (read-only). The watchlist is capped at 50 per buyer, only ACTIVE listings can be added, and add and remove are idempotent. Marketplace and detail responses gain an `isWatched` flag per requesting buyer, computed with one batch lookup per page.
8. **AI reasons are free English text and cannot be translated.** Decision (D-35): the grading result's quality notes and the price guidance explanation become reason **codes** with optional params (for example `COLOR_UNIFORM`, `MINOR_BLEMISHES`, `TREND_UP` with a percentage), mapped to i18n keys in the UI. Update the shared schemas, mock providers and listing snapshots. This is a contract change: existing development data must be reseeded (there is no production data).
9. **Client error text is English.** The UI maps every error `code` to an i18n key with a generic localized fallback; field-level server messages are never shown directly.
10. **Two small dev dependencies are needed.** An accessibility checker for Playwright and a lint rule against hard-coded UI strings. Log both in `DECISIONS.md` as D-36 before adding them.
11. **Countdowns must not spam screen readers.** Announce only at thresholds (10 minutes, 2 minutes, ended), never every second.

## Notification matrix (contract for Tasks 8.1 and 8.2)
| Event | Recipient | Type | Notes |
|---|---|---|---|
| bid.placed | Farmer | NEW_BID | Coalesced per listing while unread |
| bid.placed | Previous highest bidder (if a different buyer) | OUTBID | Includes the new price per kg only |
| auction.closed, sold | Farmer | AUCTION_SOLD | Links to the order |
| auction.closed, sold | Winning buyer | AUCTION_WON | Links to the order |
| auction.closed, sold | Every other bidder | AUCTION_LOST | Includes the final price |
| auction.closed, unsold | Farmer | AUCTION_UNSOLD | Hints at relist |
| order.created | Farmer | ORDER_UPDATE (CREATED) | Mentions the confirm deadline |
| order.confirmed | Buyer | ORDER_UPDATE (CONFIRMED) | |
| payment.paid | Farmer | ORDER_UPDATE (PAID) | |
| order.delivered | Buyer | ORDER_UPDATE (DELIVERED) | Mentions the auto-complete deadline |
| order.completed | Farmer | ORDER_UPDATE (COMPLETED) | Also sent on auto-complete |
| order.cancelled | The other party; both when cancelled by SYSTEM | ORDER_UPDATE (CANCELLED) | |
| order.disputed | Farmer | ORDER_UPDATE (DISPUTED) | |
| Scheduler pass | Farmer (own active listing), buyers who watch or have bid | ENDING_SOON | 15 minutes before the end (30 seconds in demo mode), once per listing per user |
Reminders before order deadlines and per-type opt-outs are out of scope (P2 ideas for the pitch roadmap). Delivery is in-app only; SMS is a roadmap item.

---

## Task 8.1 — Shared contracts and notification rules (P1)
Docs: PRD (F-12, B-09), DATA_MODEL (Notification, WatchlistItem), API_SPEC (Notifications, Watchlist).
Build in `packages/shared`: the notification type enum, the params schema per type, the `dedupeKey` builder, the order sub-event enum, notification and watchlist response schemas (list response with `meta.unreadCount`), constants (ending-soon window and demo value, retention days, watchlist cap, stream cap), the AI reason code enums and the new schemas for grading notes and price explanations, and a typed version of the matrix above. Confirm the `bid.placed` payload carries the previous highest bidder ID (add it if not) and that no stream mapper forwards it. Update `DATA_MODEL.md`, `API_SPEC.md` and log D-32 to D-36.
Acceptance: unit tests for every schema and the dedupe key builder; a test proving the listing stream payload contains no internal fields.

## Task 8.2 — Notification model, service and event subscribers (P1)
Docs: DESIGN_PATTERNS (backend #4), SECURITY §5, gaps 1 to 4.
Build: Notification model (indexes from `DATA_MODEL.md`, unique `(userId, dedupeKey)`, 60-day TTL), the service that creates and coalesces notifications, and subscribers for every event in the matrix. Subscribers run asynchronously after the action completes, isolate errors, exclude the acting user, look up other bidders for AUCTION_LOST, and emit internal `notification.created` and `notification.updated` events for the stream.
Acceptance: a table-driven test over the whole matrix (event × recipient × type × params); duplicate events creating one notification; coalescing counts; self-exclusion; a failing subscriber not failing a bid or a close; params containing no other user's identity.

## Task 8.3 — Ending-soon job (P1)
Docs: ARCHITECTURE §6, D-33.
Build: a scheduler pass (Phase 4.5 infrastructure, injected Clock) that finds ACTIVE listings entering the ending-soon window and creates ENDING_SOON notifications for the farmer, the watchers (Task 8.5 supplies them; until then none) and every buyer who has bid, using the dedupe key so repeated ticks and restarts create nothing extra.
Acceptance: tests with the test clock for notifying once, extension not re-notifying, listings outside the window untouched, and one failing listing not blocking others.

## Task 8.4 — Notification endpoints and the user stream (P1)
Docs: API_SPEC (Notifications, `/me/stream`), SECURITY §2, ARCHITECTURE §5, gap 5.
Build: `GET /notifications` (own only, newest first, optional unread filter, pagination, `meta.unreadCount`), `POST /notifications/read` (ids or all; ignores IDs the user does not own), and `GET /me/stream` (initial snapshot with the unread count, `notification.created` and `notification.updated` events, heartbeat every 20 seconds, cleanup on disconnect, drop-oldest when the per-user cap is exceeded, and the cap raised as in gap 5).
Acceptance: tests for ownership isolation, marking read, the unread count after coalescing, the stream delivering events live, cap behavior without rejecting new streams, and no session being rejected.

## Task 8.5 — Watchlist backend (P1)
Docs: API_SPEC (Watchlist), DATA_MODEL (WatchlistItem), D-34.
Build: WatchlistItem model (unique user and listing), `GET /watchlist` (buyer card DTOs with current status, newest saved first, pagination), `POST /watchlist` and `DELETE /watchlist/:listingId` (idempotent, ACTIVE listings only on add, cap 50), the visibility extension for ended watched listings in the listing detail rules, `isWatched` on marketplace cards and the detail response, and connect watchers to the ending-soon job. Update `API_SPEC.md`.
Acceptance: tests for idempotency, the cap, adding an ended listing being rejected, an ended watched listing staying viewable read-only, `isWatched` correctness on a page of results with a single batch query, and buyers seeing only their own watchlist.

## Task 8.6 — Web: notification bell, list page and live toasts (P1)
Docs: UI_UX_GUIDELINES (§3, §5, §6, §8), gaps 5 and 6.
Build: replace the bell placeholder with a bell showing the unread count (99+ cap), a popover with the 8 latest items and "Mark all read", and a full Notifications page (All and Unread tabs, pagination, empty state) in both layouts. Notification text is rendered from i18n keys using `params`, with the English fallback only if a key is missing. A pure function maps each notification and role to its target route (OUTBID and buyer ENDING_SOON to the listing detail, NEW_BID and farmer ENDING_SOON to Crop Bidding, AUCTION_UNSOLD to the Ended tab, order types to the right order page). Clicking marks read and navigates. A single shared `/me/stream` connection per tab with polling fallback every 30 seconds. Toasts for new notifications follow the suppression rules in gap 6. Respect reduced-motion preferences.
Acceptance: component tests for the bell states, rendering for every type in English, target mapping for every type and role, toast suppression on the matching page, no toast on updates, and polling fallback.

## Task 8.7 — Web: watchlist UI (P1)
Docs: UI_UX_GUIDELINES (§4), PRD (B-09), DESIGN_PATTERNS (frontend #8).
Build: a heart toggle on `ListingCard` and the detail page (optimistic update is allowed here, with rollback on error), the Watchlist page replacing its placeholder (cards with an ended state showing the final result, remove action, empty state with a link to the Marketplace), and a filter chip "Watching" in the marketplace filter bar if time allows.
Acceptance: component tests for the toggle with rollback, the ended-state card, the empty state and the cap error message; works at 360px.

## Task 8.8 — AI reason codes (P1)
Docs: AI_INTEGRATION §1 and §6, D-35.
Build: change the grading `qualityNotes` and the price `explanation` to reason codes with optional params in the shared schemas, mock providers and the listing and assessment snapshots; update the UI components that display them (wizard result step, listing detail, price step) to map codes to i18n keys in English now; add the contract tests. Provide a reseed note in the README for development databases.
Acceptance: provider contract tests pass; every code has an English key; a test fails if a code has no i18n key; existing screens render the new data; docs updated.

## Task 8.9 — i18n completion: parity, formatting and fonts (P1)
Docs: UI_UX_GUIDELINES §5 and §8, gap 9 and 10.
Build: a parity test that every `en` key exists in `bn` and the reverse, with no empty values and identical interpolation variables and plural forms; a missing-key handler that fails tests and shows a visible marker in development; the lint rule against hard-coded UI strings (log D-36 first) with all violations fixed; mapping of every API error `code` to localized messages; verification that the formatters render Bangla numerals, ৳ with কেজি, Bangla month names and relative time in `bn`; the Bengali web font with fallbacks and suitable line height, and layouts that survive text 30 to 40 percent longer (buttons and tabs wrap, nothing fixed-height); the `lang` attribute on the document following the language. Create `docs/BANGLA_GLOSSARY.md` with the agreed Bangla terms for core concepts (listing, floor price, bid, auction, grade, inventory, order, earnings and so on).
Acceptance: parity and missing-key tests pass; lint is clean; screenshots at 360px of the key screens in Bangla show no clipping or overflow.

## Task 8.10 — Bangla review pass (P1, needs a human)
Docs: `BANGLA_GLOSSARY.md`.
Build: have the agent produce a review sheet (a markdown or CSV file) listing every `bn` string next to its English text, grouped by screen, with the highest-visibility screens first (bid panel, listing wizard, order actions, warnings, errors, notifications). The Bangla speaker corrects it. Then the agent applies the corrections to the locale file and updates the glossary. Do not let the agent "improve" corrected strings afterwards.
Acceptance: all corrections applied; parity tests still pass; the reviewer has seen the screens in the running app, not only the sheet.

## Task 8.11 — Accessibility and mobile QA pass (P1)
Docs: UI_UX_GUIDELINES §6 and §7, TESTING §9.
Task: a review and fix task. (1) Add automated accessibility checks to Playwright (the dev dependency from D-36) on the main pages of both roles in both languages, and fix violations. (2) Implement the countdown policy from gap 11 and a reduced-motion rule for price animations, the "Extended" flash and the bell. (3) Walk the UI Guidelines §6 checklist: 44 px targets, contrast, focus rings, landmarks, alt text, labels with errors, keyboard-operable dialogs and menus. (4) Test at 360 px with CPU and network throttling and in both orientations; check safe areas and sticky bars. (5) Audit every list and data view for loading, empty, error and forbidden states and fix the gaps. Report findings and fixes.
Acceptance: automated checks pass with no serious or critical issues; the checklist is ticked in the report; no console errors on the main pages.

## Task 8.12 — Optional polish (P2): landing page and installable app
Skip this task if you already added a landing page.
Build: a public landing page with the "Better Price, Stronger Farmer" message, a short three-step explanation of the farmer and buyer flows, role-specific calls to action, the language switch, and a link to log in; plus a web app manifest, icons and theme color so the site can be added to a phone's home screen (no service worker and no offline mode).
Acceptance: the page is responsive and accessible (axe clean), works in both languages, and logged-in users are redirected to their dashboards.

## Task 8.13 — Phase 8 end-to-end and docs check
Docs: TESTING §5, README.
Build: Playwright in demo mode: (1) a buyer bids and the farmer's bell count increases live with a toast; (2) a second buyer outbids and the first buyer is notified, and the farmer's NEW_BID notification is coalesced; (3) an auction ends and the winner, the farmer and a losing bidder each get the right notification; (4) a watched listing triggers an ending-soon notification in demo mode; (5) the language switch to Bangla on key screens, with the document language, Bangla numerals and no missing-key markers; (6) accessibility checks on key screens. Update `API_SPEC.md`, `DATA_MODEL.md`, `DECISIONS.md`, `BANGLA_GLOSSARY.md`, the README and `.env.example`.
Acceptance: Playwright passes repeatedly; docs match the code; typecheck, lint and all tests pass.

---

## Phase 8 acceptance (check before Phase 9)
- Every event in the matrix creates the right notification once, for the right person, without leaking identities, and never breaks the main action
- The bell, notification page and toasts work live, with polling as a fallback
- The watchlist works end to end and ended watched listings stay viewable
- The UI is fully available in English and Bangla (parity enforced, Bangla reviewed by a speaker, numerals and fonts correct)
- The accessibility and mobile checklist passes, with automated checks in CI
- Docs are current; typecheck, lint, unit, integration and Playwright tests pass

Phase 9 is the finale: the real AI service, final demo data and demo mode, deployment, the smoke test on the deployed build, and the demo rehearsal.
