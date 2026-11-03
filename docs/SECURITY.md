# Security & Privacy — BazarBeat

## 1. Authentication
- Phone number + password (email optional). Passwords hashed with argon2 or bcrypt (cost ≥ 12); minimum 8 chars; reject top common passwords.
- Session: short-lived access JWT (15 min) and rotating refresh token (7 days), both in httpOnly, Secure, SameSite=Lax cookies. Refresh tokens stored hashed server-side to allow revocation; rotate on use; reuse detection revokes the family.
- Logout clears cookies and revokes the refresh token.
- CSRF: SameSite cookies plus `X-CSRF-Protection: 1` on state-changing requests; CORS restricted to configured origins with credentials.
- Rate limit and lock out: 10 attempts/min/IP on auth; progressive delay after repeated failures per phone number.
- OTP/phone verification is out of scope for MVP (note in decisions); structure the code so it can be added.

## 2. Authorization
- Role (FARMER, BUYER) is stored on the user and checked in middleware.
- Ownership checks happen in services (e.g. a farmer can only cancel their own listing). Never rely on client-provided user IDs.
- Deny by default: every route declares its allowed roles explicitly.
- Tests must include negative cases for every protected route (wrong role, wrong owner, no session).

## 3. Input validation and injection
- Validate every body, query, and param with zod; strip unknown keys.
- Block NoSQL operator injection: reject keys starting with `$` or containing `.` in user input; never pass raw query objects to Mongoose.
- Escape/encode on output via React defaults; no raw HTML.

## 4. File uploads
- Allow jpeg/png/webp only; verify by content, not extension; max 5 MB each, max 4 files.
- Re-encode with sharp (neutralizes embedded payloads), strip EXIF (removes GPS), randomize filenames, store outside the web root or via the storage adapter with controlled URLs.
- Serve with correct content type and `nosniff`.

## 5. Data protection and privacy
- Collect only what is needed. Phone numbers are private: never in listing/bid responses; revealed to the counterparty only after an order is CONFIRMED.
- Farmers' location in public views is limited to division/district (upazila optional by choice).
- Mask phone numbers in logs. No tokens or passwords in logs.
- Provide account deletion/anonymization (P2) while keeping order records for integrity.

## 6. Transport and headers
HTTPS only in production; HSTS; helmet defaults; strict CORS allowlist; `Cache-Control: no-store` on authenticated responses; content-security-policy on the web host.

## 7. Abuse and fraud controls
- Rate limits: bids 20/min/user, AI 10/min/user, uploads per day cap.
- Bids are binding; track buyer cancellation counts after wins.
- Detect suspicious bid patterns (same buyer repeatedly bidding then cancelling, bids at the last second on many auctions) — log only in MVP.
- Anonymized bidder labels reduce collusion and harassment.
- All state-changing actions on auctions and orders are written to an audit trail (who, what, when, before/after status).

## 8. Secrets and configuration
Secrets only via environment variables; `.env` ignored by git; `.env.example` contains placeholders; fail on boot if required secrets are missing or weak; different secrets per environment.

## 9. Dependency hygiene
Lockfile committed; `npm audit` in CI (report-only for hackathon); avoid unmaintained packages; no postinstall scripts from unknown packages.

## 10. Payments note
No real money handling in MVP. The payment provider is a simulation. Do not collect card or wallet credentials. Real integration requires a separate security review.

## 11. Security checklist per feature (agents must verify)
- [ ] Route has auth, role, and ownership checks
- [ ] Inputs validated by zod
- [ ] No sensitive data in response or logs
- [ ] Rate limit applied where abuse is plausible
- [ ] Negative authorization tests exist
