# Coding Standards — BazarBeat

## 1. Language and tooling
- TypeScript `strict`, plus `noUncheckedIndexedAccess` and `noImplicitOverride`.
- ESLint (typescript-eslint, react-hooks, import ordering) and Prettier; one shared config at repo root.
- Scripts at root: `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`, `seed`, `seed:demo`.
- Pre-commit: lint-staged (format + lint) and typecheck on push.

## 2. Naming
| Thing | Convention | Example |
|---|---|---|
| Files/folders | kebab-case | `listing-card.tsx` |
| Components | PascalCase | `ListingCard` |
| Hooks | `use` prefix | `useCountdown` |
| Types/interfaces | PascalCase, no `I` prefix | `ListingResponse` |
| Zod schemas | camelCase + `Schema` | `placeBidSchema` |
| Enums/consts | SCREAMING_SNAKE for values, PascalCase for enum names | `ListingStatus.ACTIVE` |
| Mongoose models | singular PascalCase, collection plural | `Listing` → `listings` |
| Booleans | `is/has/can` prefix | `isExpired` |

## 3. Code style rules
- Functions do one thing; aim for under 40 lines.
- Prefer pure functions; isolate side effects at the edges.
- Early returns over deep nesting.
- Named exports only (default export only where a framework requires it).
- Explicit return types on exported functions and service methods.
- Use `unknown` plus narrowing instead of `any`; parse external data with zod.
- Constants and enums come from `packages/shared`; no magic strings or numbers inline.
- Comments explain **why**, not what. Public service methods get a one-line doc comment stating rules enforced.

## 4. Money, units, dates
- Money: integer poisha; prices are per kg. Totals = price per kg × quantity kg (quantity is stored in kg with at most one decimal place; totals are rounded to whole poisha by one shared helper).
- Use only helpers from `packages/shared/money.ts` for arithmetic and formatting.
- Dates: UTC ISO strings on the wire; Mongo `Date` in storage; convert to local (Asia/Dhaka) only in the UI formatter.

## 5. Error handling
- Throw typed errors in services; never return error strings.
- Include a stable machine-readable `code` (see `API_SPEC.md`) and a human message.
- Log unexpected errors once, at the error middleware.

## 6. Logging
- Levels: `error` (unexpected), `warn` (rule rejections worth watching), `info` (lifecycle events: auction closed), `debug` (dev only).
- Include request ID, user ID, and entity IDs; exclude PII and secrets.

## 7. Git workflow
- Branches: `main` (always demoable), `feat/<phase>-<short-name>`, `fix/<short-name>`.
- Commits: Conventional Commits; small and focused.
- Pull requests (or merges) require typecheck, lint, tests passing.
- Never commit `.env`, uploads, or build output.

## 8. Dependencies
- Pin major versions; use lockfile; keep the approved list in `ARCHITECTURE.md` §9.
- Prefer platform features over libraries.

## 9. File and module hygiene
- One concept per file. Max ~300 lines per file.
- No circular imports. Features import from `shared` and `components/shared`, never from each other's internals.
- Barrel files (`index.ts`) only at package boundaries.

## 10. Frontend specifics
- Components are function components with typed props.
- Keep JSX shallow; extract subcomponents at ~5 levels deep.
- Data fetching only in feature `api/` hooks, never inside presentational components.
- No inline styles; Tailwind utilities with `cn()` helper; use design tokens (`UI_UX_GUIDELINES.md`).
- Never use `dangerouslySetInnerHTML`.
- Accessibility lint rules on; interactive elements are real buttons/links.

## 11. Backend specifics
- Handlers are wrapped with the async error helper.
- Every route has: validation middleware, auth middleware, role/ownership check.
- Mongoose: define indexes in the schema; use `lean()` for read paths; select only needed fields.
- Never trust client-supplied IDs for ownership; derive the actor from the session.

## 12. Review checklist (agents self-review before reporting)
- [ ] Types strict, no `any`
- [ ] Validation + auth + ownership present
- [ ] State changes via state machine
- [ ] Money and time rules respected
- [ ] Tests added/updated
- [ ] UI states handled (loading/empty/error/forbidden), mobile checked
- [ ] Docs updated if contracts changed
