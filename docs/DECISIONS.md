# Decisions & Open Questions — BazarBeat

Log every decision that changes scope, adds a dependency, or interprets an unclear requirement. Newest at the bottom. Format: ID · Date · Decision · Reason · Status.

## Open questions (need a human answer)
| ID | Question | Current default |
|---|---|---|
| D-03 | Where does grading/price training data come from (public datasets, own photos, government price bulletins)? | Mock providers until a model exists |
| D-04 | Who handles transport after a sale? | Buyer-arranged pickup in MVP |
| D-05 | Payment in the demo: COD only, or simulated wallet too? | Both simulated; no real money |
| D-06 | Hackathon rules: team size, deadline, judging criteria, required submission format? | Unknown — shape the demo script after answering |
| D-07 | Platform fee: charge or show 0% as a growth message? | Configurable; default 0%, displayed transparently |

## Decisions
| ID | Date | Decision | Reason | Status |
|---|---|---|---|---|
| D-01 | Project start | Monorepo with npm workspaces and a shared contracts package | One source of truth for types between web and api; simplest for AI agents | Accepted |
| D-02 | 2026-11-03 | Initial MVP crop catalog: Onion, Green Chilli, Tomato, Eggplant, and Potato | User selected the five catalog crops; superseded by D-30 | Superseded |
| D-08 | Project start | Open ascending auction with a visible floor price as the opening bid | Simple to understand for farmers; keeps farmer's fallback logic clear | Accepted |
| D-09 | Project start | Real-time via Server-Sent Events, with polling fallback | No extra dependency; one-way updates are enough; works with Express | Accepted |
| D-10 | Project start | Money stored as integer poisha, prices per kg | Avoids float errors | Accepted |
| D-11 | Project start | httpOnly cookie JWT sessions with refresh rotation | Safer than tokens in local storage; satisfies "secure sessions or JWT" | Accepted |
| D-12 | Project start | AI behind provider adapters with deterministic mocks by default | Demo works offline; real model can be swapped later | Accepted |
| D-13 | Project start | Whole-lot sales only; one crop per listing; kg unit only | Reduces edge cases for MVP | Accepted |
| D-14 | Project start | Anti-sniping: 2-minute window, max 5 extensions | Fairness to bidders, bounded wait for farmers | Accepted |
| D-15 | Project start | Bangla UI is P1/P2 but i18n keys used from day one | Avoids a costly retrofit | Accepted |
| D-16 | Project start | Single-instance deployment for the hackathon (in-process events, scheduler) | Time constraint; limitation is declared | Accepted |
| D-17 | 2026-11-03 | Use `concurrently` for the root dev command and `tsx` to run the TypeScript API during development | Starts both workspace apps from one command without a build step | Accepted |
| D-18 | 2026-11-03 | Use `jsdom` as the Vitest environment for web component tests | Provides a browser DOM for React Testing Library tests | Accepted |
| D-19 | 2026-11-03 | Declare `caniuse-lite` in the web workspace | Keeps Browserslist's browser feature database present in clean installs; without it Vite's React transform fails | Accepted |
| D-20 | 2026-11-03 | Treat Phase 1 Task 1.2 as the User persistence model only | The build plan groups Phase 1 work without numbering individual tasks; this follows Task 1.1 shared contracts and keeps the next slice narrow | Accepted |
| D-21 | 2026-11-03 | Hash registration passwords with bcrypt cost 12 | Meets the password storage requirement using the architecture-approved algorithm | Accepted |
| D-22 | 2026-11-03 | Use express-rate-limit for the auth endpoint limit of 10 attempts per minute per IP | Applies the documented auth abuse limit with the architecture-approved package | Accepted |
| D-23 | 2026-11-03 | Sign HS256 access and refresh JWTs with Node crypto and require `X-CSRF-Protection: 1` for state-changing auth requests | Avoids an extra JWT dependency and gives the documented custom-header CSRF guard a concrete name and value | Accepted |
| D-24 | 2026-11-03 | Require 32-character JWT secrets and a non-localhost cookie domain in production | Prevents auth tokens from using the development defaults in production | Accepted |
| D-25 | 2026-11-03 | Use cookie-parser for refresh-token cookie extraction | Uses the architecture-approved middleware instead of manually parsing Cookie headers | Accepted |
| D-26 | 2026-11-03 | Authenticate protected requests from the access cookie and revoke only the presented refresh token on logout | Keeps logout scoped to the current device session while allowing other active sessions to continue | Accepted |
| D-27 | 2026-11-03 | Treat Phase 1 Task 1.7 as `PATCH /me` profile updates | The build plan does not number subtasks; this follows the completed auth endpoints before the planned web auth and layout work | Accepted |
| D-28 | 2026-11-03 | Use `mongodb-memory-server` for inventory integration tests covering transactions and concurrent updates | This package is pre-approved in ARCHITECTURE §9 and provides an isolated Mongo replica set for ledger consistency tests | Accepted |
| D-29 | 2026-11-03 | Attempt Mongo transactions for each inventory movement; on unsupported standalone deployments, persist a unique PENDING ledger intent, atomically update the bucket with a pending marker, then mark APPLIED and clear the marker | Preserves idempotency and prevents concurrent movements from overtaking an interrupted ledger write without requiring a replica set | Accepted |
| D-30 | 2026-11-03 | Replace Tomato with Bitter Gourd in the five-crop MVP catalog; use its existing 10–1,000 kg lot bounds and 120-hour shelf-life as the starting values, with Bitter Gourd-specific grade guidance; deactivate Tomato when reseeding | User requested the crop substitution; no Bitter Gourd lot or shelf-life values were specified | Accepted |
| D-31 | 2026-11-04 | Define public config with only `demoMode`; derive durations from shared presets | No other public-config fields are specified | Accepted |
