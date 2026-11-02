# UI/UX Guidelines — BazarBeat

## 1. Design principles
1. **Trust first:** prices, grades, and timers must be unambiguous and always visible.
2. **Mobile-first, thumb-friendly:** farmers use phones; design at 360px, then scale up.
3. **Low literacy friendly:** icons with labels, short sentences, numbers formatted clearly, Bangla available.
4. **Calm urgency:** countdowns create pressure; keep the rest of the UI quiet.
5. **Never block the farmer:** every step explains the fallback ("you can still sell locally").

## 2. Visual language
| Token | Use | Direction |
|---|---|---|
| Primary | Brand, main actions | Deep leaf green |
| Accent | Prices, bids, highlights | Warm amber/gold |
| Success / Warning / Danger | States | Green / amber / red from the Tailwind palette |
| Grade A / B / C | Quality badges | Green / amber / orange, always with the letter (never color alone) |
| Neutrals | Surfaces and text | Warm stone/gray scale |
Define all colors as CSS variables via the shadcn theme; support light mode first, dark mode optional (P2). Rounded corners (md–lg), soft shadows, generous spacing. Font: a clean sans-serif with Bangla support (e.g. a Noto Sans family pairing) loaded with fallbacks.

## 3. Layout and navigation
- **Farmer sidebar:** Dashboard · Products (My Listings + New Listing) · Crop Bidding · Inventory · Orders · Sales · Earnings · Market Prices · Settings.
- **Buyer sidebar:** Dashboard · Marketplace · Compare · My Bids · Orders · Watchlist · Market Overview · Settings.
- Desktop: persistent collapsible sidebar + top bar (page title, notifications bell, language switch, user menu).
- Mobile: sidebar becomes a slide-in drawer; primary actions in a sticky bottom bar (e.g. "Place bid", "Publish").
- Sidebar items are config-driven per role and highlight the active route. Role layouts are separate; a farmer can never see buyer pages and vice versa.

## 4. Key screens and requirements
**Farmer dashboard:** KPI cards (total sales, earnings this month, active auctions, pending orders, win rate), sales trend line, earnings by crop bar chart, list of auctions ending soon, quick "New listing" button.
**New listing wizard (stepper):** 1 Crop → 2 Photos (tips + capture/upload, previews) → 3 AI result (grade badge, confidence, reasons) → 4 Price (AI range visual with a draggable/typed floor, local market estimate card, "sell locally" reassurance) → 5 Quantity & timer → 6 Review & publish. Save progress between steps; show a clear back path.
**Crop Bidding (farmer):** live cards with big current price, bid count, countdown, mini bid history; actions Cancel / Accept now when allowed; unsold results with Relist.
**Marketplace (buyer):** filter bar (sheet on mobile), card grid with photo, crop, grade badge, qty, floor/current price, time left, region; "Add to compare" checkbox; sticky compare tray at the bottom once items are selected.
**Listing detail:** photo gallery, grade with explanation, AI market range vs current bid (visual), countdown, bid panel (suggested next bid buttons: min, +5%, +10%), bid history list, farmer region.
**Compare:** responsive table or stacked cards; rows: crop, grade, quantity, current price/kg, total cost, region, time left, AI market range; highlight the best value per row; CTA per column.
**Orders:** timeline of statuses, action buttons based on role and state, contact details revealed only per rules.
**Empty states:** friendly illustration/icon + one clear next action.

## 4b. Shared components (build once, reuse)
`CountdownTimer`, `GradeBadge`, `PriceTag` (৳ + per kg), `StatCard`, `LiveBidIndicator`, `ListingCard`, `CompareTray`, `EmptyState`, `ErrorState`, `PageHeader`, `DataTable`, `ImageUploader`, `Stepper`, `NotificationBell`, `RoleSidebar`.

## 5. Behavior rules
- **Countdown:** based on server time offset; turns amber under 10 minutes, red under 2; shows "Extended" flash when anti-sniping applies; shows "Finalizing…" at zero until the server confirms.
- **Live updates:** price changes animate subtly; a toast announces "New bid"; no layout jumps.
- **Bidding feedback:** disable the button while pending; show exact server error messages mapped to friendly text; never show "success" before the server confirms.
- **Forms:** inline validation, numeric keyboards for numbers, units always visible (kg, ৳/kg).
- **Currency:** `৳ 45.00/kg`; large totals use thousands separators; Bangla numerals when language is bn (formatter-level).
- **Dates/time:** relative for near-term ("ends in 2h 10m"), absolute with Asia/Dhaka for history.
- **Feedback:** toasts for transient success; inline alerts for persistent problems.

## 6. Accessibility
Minimum 44×44px touch targets · contrast AA · visible focus rings · semantic landmarks · aria-live for bid updates (polite) · images with alt text · forms with labels and error association · keyboard operable dialogs and menus (shadcn/Radix defaults retained).

## 7. Performance
Route-level code splitting · image lazy loading with fixed aspect ratios · skeletons instead of spinners · debounce filters · paginate lists · avoid layout shift on live updates.

## 8. Internationalization
All strings through react-i18next keys from the first screen; locale files `en` and `bn`; no concatenated sentences; numbers/currency/dates via formatters. Bangla translation completes in P1/P2, but the key structure is mandatory from Phase 1.

## 9. shadcn/ui usage
Use primitives: Button, Card, Input, Select, Dialog, Sheet, Tabs, Table, Badge, Toast/Sonner, Skeleton, Tooltip, Dropdown Menu, Sidebar, Form, Progress, Alert, Chart. Compose them into shared components; do not fork shadcn internals unless needed (then note it in the file header).
