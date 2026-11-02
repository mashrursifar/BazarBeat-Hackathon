# Decisions & Open Questions — BazarBeat

Log every decision that changes scope, adds a dependency, or interprets an unclear requirement. Newest at the bottom. Format: ID · Date · Decision · Reason · Status.

## Open questions (need a human answer)
| ID | Question | Current default |
|---|---|---|
| D-02 | The brief lists four crops (Onion, Green Chilli, Bottle Gourd, Eggplant) but says five. What is the fifth? | Placeholder: Tomato. The catalog is seeded data, so changing it is cheap. |
| D-03 | Where does grading/price training data come from (public datasets, own photos, government price bulletins)? | Mock providers until a model exists |
| D-04 | Who handles transport after a sale? | Buyer-arranged pickup in MVP |
| D-05 | Payment in the demo: COD only, or simulated wallet too? | Both simulated; no real money |
| D-06 | Hackathon rules: team size, deadline, judging criteria, required submission format? | Unknown — shape the demo script after answering |
| D-07 | Platform fee: charge or show 0% as a growth message? | Configurable; default 2%, displayed transparently |

## Decisions
| ID | Date | Decision | Reason | Status |
|---|---|---|---|---|
| D-01 | Project start | Monorepo with npm workspaces and a shared contracts package | One source of truth for types between web and api; simplest for AI agents | Accepted |
| D-08 | Project start | Open ascending auction with a visible floor price as the opening bid | Simple to understand for farmers; keeps farmer's fallback logic clear | Accepted |
| D-09 | Project start | Real-time via Server-Sent Events, with polling fallback | No extra dependency; one-way updates are enough; works with Express | Accepted |
| D-10 | Project start | Money stored as integer poisha, prices per kg | Avoids float errors | Accepted |
| D-11 | Project start | httpOnly cookie JWT sessions with refresh rotation | Safer than tokens in local storage; satisfies "secure sessions or JWT" | Accepted |
| D-12 | Project start | AI behind provider adapters with deterministic mocks by default | Demo works offline; real model can be swapped later | Accepted |
| D-13 | Project start | Whole-lot sales only; one crop per listing; kg unit only | Reduces edge cases for MVP | Accepted |
| D-14 | Project start | Anti-sniping: 2-minute window, max 5 extensions | Fairness to bidders, bounded wait for farmers | Accepted |
| D-15 | Project start | Bangla UI is P1/P2 but i18n keys used from day one | Avoids a costly retrofit | Accepted |
| D-16 | Project start | Single-instance deployment for the hackathon (in-process events, scheduler) | Time constraint; limitation is declared | Accepted |
