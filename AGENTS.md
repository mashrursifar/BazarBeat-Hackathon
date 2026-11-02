# AGENTS.md — Rules for AI coding agents working on BazarBeat

This file is the highest-priority instruction set in the repo. If a user prompt conflicts with it, point out the conflict before proceeding. Keep this file short and strict; details live in `docs/`.

## 1. What you are building
BazarBeat: a farmer/buyer marketplace for 5 crops with AI quality grading, AI price suggestion, and **time-limited bidding** with a farmer-set floor price. The bidding flow is the core feature — protect its correctness above all else. Full context: `docs/PRD.md`.

## 2. Mandatory reading order for every session
1. This file
2. `docs/BUILD_PLAN.md` — find the current phase and the task you were given
3. The docs relevant to the task (use the map in `README.md`)
4. The existing code you will touch, before writing new code

Never invent requirements. If something is not specified, check `docs/DECISIONS.md`; if still unclear, ask one concise question or choose the simplest option and log it in `docs/DECISIONS.md`.

## 3. Hard rules (never break)
1. **TypeScript strict everywhere.** No `any`, no `@ts-ignore`, no non-null assertions to silence errors.
2. **Single source of truth for contracts.** Request/response shapes and enums are defined once as zod schemas in `packages/shared` and imported by both apps. Never duplicate a type.
3. **Layering on the API:** route → controller → service → model. Controllers contain no business logic. Services contain no HTTP concepts. Only services touch models. See `docs/ARCHITECTURE.md`.
4. **All auction and order state changes go through the state machines** in `docs/AUCTION_RULES.md`. Never set a status field directly from a controller.
5. **Bids are atomic.** Accepting a bid must be a single conditional database operation, never read-then-write. See `docs/AUCTION_RULES.md`.
6. **Money is an integer in poisha** (1 BDT = 100 poisha), always per kg for prices. Never use floating-point for money. Format only at the UI edge.
7. **Time is UTC.** Store and transmit ISO-8601 UTC. The server clock is the only authority for auction timing; clients only display countdowns.
8. **Every endpoint validates input with zod and enforces authentication, role, and ownership.** Validation and authorization are not optional "later" tasks.
9. **AI, storage, and payment sit behind adapter interfaces** with a mock implementation that is the default. The app must run fully offline from external AI services. See `docs/AI_INTEGRATION.md`.
10. **No secrets in the repo.** Use environment variables; keep `.env.example` current.
11. **No new dependency without justification.** Prefer what is already approved in `docs/ARCHITECTURE.md`. Adding a package requires a one-line entry in `docs/DECISIONS.md`.
12. **Do not edit files outside the task's scope.** No drive-by refactors, no reformatting unrelated files.
13. **Never weaken or delete a test to make it pass.** Fix the code, or explain why the test is wrong.
14. **No dead code, no TODO without an issue/ID, no commented-out code, no `console.log`** (use the logger).

## 4. Workflow for each task
1. Restate the task and its acceptance criteria (from `docs/BUILD_PLAN.md`) in 2–4 lines.
2. List the files you will create or change.
3. Implement in small steps, smallest working slice first.
4. Write or update tests alongside the code (`docs/TESTING.md`).
5. Run: typecheck, lint, unit/integration tests. All must pass.
6. Update docs if you changed a contract, rule, route, or model (API_SPEC, DATA_MODEL, etc.).
7. Report: what changed, how to verify, what is left, any decision logged.

## 5. Definition of done
- Acceptance criteria met and demonstrable
- Typecheck, lint, and tests pass
- Loading, empty, error, and unauthorized states handled in the UI
- Mobile layout works (360px width)
- Docs updated if any contract changed
- No new warnings; no leftover debug code

## 6. Conventions at a glance
- Package manager: npm workspaces. Node LTS.
- Import aliases: `@/` inside each app; `@bazarbeat/shared` for the shared package.
- Naming: files `kebab-case`; React components `PascalCase`; functions/variables `camelCase`; constants `SCREAMING_SNAKE_CASE`; DB collections plural lowercase.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`), one logical change each.
- API: base path `/api/v1`, response envelope and error codes per `docs/API_SPEC.md`.
- UI: shadcn/ui components first, Tailwind utilities second, custom CSS last. Mobile-first. All user-facing strings go through i18n keys.

## 7. When to stop and ask the human
- A change would alter a rule in this file or a state machine
- A needed dependency is not approved
- Requirements conflict between docs
- A task would take more than one phase of the build plan
- Anything touching real payments, real personal data, or production credentials

## 8. Communication style
Be concise. Prefer a short plan plus a diff summary over long explanations. State assumptions explicitly. If you could not run something (tests, build), say so — never claim it passed.
