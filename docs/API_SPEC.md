# API Specification — BazarBeat

Base path: `/api/v1`. JSON only (uploads are multipart). Auth via httpOnly cookies unless noted. All request/response shapes are zod schemas in `packages/shared`. Update this file whenever a route changes.

State-changing requests require the `X-CSRF-Protection: 1` header.

## Conventions
**Success envelope:** `{ data, meta? }` where `meta` carries pagination `{ page, limit, total }` and server time `{ serverTime }` on listing/bid responses.
**Error envelope:** `{ error: { code, message, details? } }`.
**Pagination:** `?page=1&limit=20` (limit max 50). **Sorting:** `?sort=endsAt` or `-createdAt`.
**Roles:** F = farmer, B = buyer, A = any authenticated, P = public.

## Error codes
`VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `RATE_LIMITED` 429 · `INTERNAL` 500 · Business: `AUCTION_CLOSED`, `BID_TOO_LOW`, `OWN_LISTING`, `INSUFFICIENT_STOCK`, `GRADE_UNAVAILABLE`, `CROP_MISMATCH`, `INVALID_TRANSITION`, `HAS_BIDS`, `BELOW_FLOOR` (all 409 or 422 as noted in the module).

## Auth
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | /auth/register | P | Create farmer or buyer account |
| POST | /auth/login | P | Login by phone + password, sets cookies |
| POST | /auth/refresh | A | Rotate the refresh cookie; reuse revokes the token family |
| POST | /auth/logout | A | Clear cookies |
| GET | /me | A | Current user profile |
| PATCH | /me | A | Update profile and language |

## Catalog and market data
| GET | /crops | P | Active crops with limits and grade guides |
| GET | /market-prices?cropId&division&range | A | Price history and trend |
| GET | /market-prices/national-summary | B | Avg listing price per crop per division |

## AI
| POST | /ai/assess-quality | F | Multipart: cropId + 1–4 images → grade result |
| POST | /ai/predict-price | F | cropId, grade, quantityKg, optional local selling cost → price guidance |
Results are returned to the client and also re-verified on listing creation via a short-lived assessment token (see `AI_INTEGRATION.md`), so clients cannot forge a grade.

## Inventory (F)
| GET | /inventory | Stock summary per crop |
| POST | /inventory/add | Add harvested stock |
| GET | /inventory/movements?cropId | Ledger |

## Listings
| POST | /listings | F | Create and publish (requires valid assessment token, stock, valid floor and duration) |
| GET | /listings | A | Marketplace search with filters: cropId, grade, division, district, minPrice, maxPrice, minQty, endingWithin, status (default ACTIVE); sort |
| GET | /listings/:id | A | Detail incl. bid summary and AI data |
| GET | /listings/mine | F | Farmer's listings with filters by status |
| POST | /listings/:id/cancel | F | Only if no bids |
| POST | /listings/:id/accept-current-bid | F | Close early if current bid ≥ floor |
| POST | /listings/:id/relist | F | Create a new listing from an unsold one (re-runs stock check; keeps grade only if within freshness window) |
| GET | /listings/:id/stream | A | SSE: bid.placed, auction.extended, auction.closed |
| GET | /listings/compare?ids=a,b,c,d | B | Compare payload (max 4) |

## Bids
| POST | /listings/:id/bids | B | Place bid `{ amountPerKg }` |
| GET | /listings/:id/bids | A | Bid history (bidders anonymized for non-owners; farmer sees anonymized too, buyer names revealed only on order) |
| GET | /bids/mine | B | My bids grouped: active (winning/outbid), won, lost |

## Orders
| GET | /orders | A | Role-scoped list with filters |
| GET | /orders/:id | A | Detail (participants only) |
| POST | /orders/:id/confirm | F | Farmer confirms and sets handover info |
| POST | /orders/:id/mark-paid | B | Simulated payment |
| POST | /orders/:id/mark-delivered | F | |
| POST | /orders/:id/complete | B | Buyer confirms receipt |
| POST | /orders/:id/dispute | B | P1 |
| POST | /orders/:id/cancel | A | Allowed only in states defined by the order state machine |

## Dashboards
| GET | /dashboards/farmer | F | KPIs + series: sales trend, earnings by crop, win rate, active auctions |
| GET | /dashboards/buyer | B | KPIs + series: spend trend, purchases by crop, avg price vs market, win rate |
| GET | /earnings | F | Totals, per-crop, payout statuses |
| GET | /sales | F | Paginated completed sales |

## Notifications
| GET | /notifications | A | Paginated |
| POST | /notifications/read | A | Mark ids or all as read |
| GET | /me/stream | A | SSE: notification.created |

## Watchlist (P1)
| GET/POST/DELETE | /watchlist | B | |

## Ops
| GET | /health | P | Liveness and DB status |

## Authorization matrix rules
- Farmers can read/modify only their own listings, inventory, and orders.
- Buyers can read all ACTIVE listings; only their own bids and orders.
- Private fields (phone, exact address, password hash) are never in listing/bid responses; contact details appear on an order only after CONFIRMED, and only to its two participants.

## Rate limits
Auth endpoints 10/min/IP · Bidding 20/min/user · AI endpoints 10/min/user · General 120/min/user.

## Idempotency
`POST /listings/:id/bids` accepts an `Idempotency-Key` header; repeated keys return the original result.
