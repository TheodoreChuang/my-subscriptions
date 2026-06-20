---
title: "feat: S1 — App shell, foundation, and initial deploy"
date: 2026-06-20
type: feat
depth: lightweight
origin: docs/plans/2026-06-20-001-feat-build-sequence-plan.md
status: completed
---

# feat: S1 — App shell, foundation, and initial deploy

## Summary

Completes the S1 slice of the build sequence plan. The `create-next-app` scaffold
(Next.js 16.2.9, strict TS, Tailwind v4, ESLint) is already in place; this plan
covers the remaining S1 items:

- System boundary directories (`frontend` / `modules` / `infrastructure` / `shared`)
- Test infrastructure (Vitest + React Testing Library, per the Next.js 16 guide)
- `typecheck` and `test` scripts runnable locally
- Zod env validation wired at build time, with a server / `NEXT_PUBLIC_` split in place for future vars
- Logger capability composition root (concrete; establishes the pattern for S4+ capabilities)
- CI running typecheck + lint + test on pull requests
- Initial Vercel deployment (retire deployment integration risk on day 1)

**Demo milestone (S1):** the app is deployed and reachable at a public Vercel URL;
the full toolchain — lint, typecheck, test, CI — is green.

---

## Problem Frame

The scaffold has no project structure, no test runner, no env safety net, no CI, and
no deployment. The S1 sequencing principle is: retire deployment integration risk on
day 1 and establish the directory seams every later slice imports from. Every deferred
item here costs more to retrofit than to establish now.

---

## Requirements

Drawn from S1 in the build sequence (see origin) and `context/project-setup.md`:

- R1: `frontend`, `modules`, `infrastructure`, and `shared` boundary directories exist.
- R2: Lint, typecheck, and tests are runnable locally and all pass.
- R3: CI runs typecheck + lint + test on pull requests.
- R4: Env vars are validated via Zod at build-time startup; missing vars fail fast with a clear error.
- R5: Logger capability composition root established (concrete console logger).
- R6: App deployed to Vercel; public URL returns HTTP 200.

---

## Key Technical Decisions

**KTD1 — Vitest with the official Next.js 16 setup.**
The Next.js 16 docs (`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`)
prescribe `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`,
`@testing-library/dom`, and `vite-tsconfig-paths`. Install the full stack now — even
though S1 tests are pure TypeScript, S2+ will test React components and this avoids
a revisit. Use `environment: 'jsdom'` per the guide. Vitest auto-detects CI (via
`process.env.CI` / no TTY) and runs in single-pass mode without an extra flag.

**KTD2 — Env validation in `shared/env.ts`, imported at the top of `next.config.ts`.**
Importing the Zod schema from `next.config.ts` runs validation at `next build` and
`next dev` startup — not lazily on first request. Zod's default error output names
the failing key clearly; no custom error handling is needed. Use a relative import
(`./shared/env`) rather than the `@/` alias — tsconfig path aliases may not resolve
inside `next.config.ts`, which runs outside the bundler's module graph. The S1 schema
uses a single merged parse; when S4 introduces client-side consumers of env, the schema
will need to split into server-only and browser-safe parses (a single merged parse
exposes server secrets to the client bundle). That restructure is deferred — with zero
client consumers in S1, the risk is nil.

**KTD3 — Logger is the only capability root in S1.**
Per the architecture restraint principle ("no interface without a caller"), only the
logger is made concrete in S1 — it has no external dependencies and is immediately
useful for debugging during later slices. Database, auth, and AI composition roots are
scaffolded when their slices begin (S4, S8 respectively).

**KTD4 — No new path aliases beyond `@/*`.**
The existing `"@/*": ["./*"]` in `tsconfig.json` already resolves all boundary
imports (`@/modules/...`, `@/infrastructure/...`, etc.). `vite-tsconfig-paths` picks
this up for Vitest. Adding per-boundary aliases is not warranted until deep import
paths become a readability problem.

---

## Implementation Units

### U1. Vitest test infrastructure

**Goal:** `npm run test`, `npm run typecheck`, and `npm run lint` all exit 0 locally.

**Requirements:** R2

**Dependencies:** none

**Files:**
- `package.json` — add `test`, `typecheck` scripts; install Vitest + companions as dev deps
- `vitest.config.mts` — configure per the Next.js 16 guide
- `__tests__/smoke.test.ts` — one trivial assertion to confirm the runner works

**Approach:** Install as dev dependencies: `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`. The `vitest.config.mts` uses `tsconfigPaths()` and `react()` plugins with `environment: 'jsdom'`, matching the guide exactly. Add scripts: `"typecheck": "tsc --noEmit"` and `"test": "vitest"`. The smoke test lives in `__tests__/` (the conventional Next.js colocation per the guide).

**Test scenarios:**
- Smoke test `expect(1 + 1).toBe(2)` passes — confirms Vitest resolves and runs
- `npm run typecheck` exits 0 on the unmodified scaffold
- `npm run lint` exits 0 on the unmodified scaffold

**Verification:** All three scripts exit 0 in a clean checkout.

---

### U2. System boundary directories

**Goal:** The four custom boundary directories exist with placeholder barrel files so
TypeScript resolves imports from each boundary from the first line of later-slice code.

**Requirements:** R1

**Dependencies:** U1 (so typecheck validates the new files immediately)

**Files:**
- `modules/index.ts`
- `infrastructure/index.ts`
- `shared/index.ts`

**Approach:** Each `index.ts` exports nothing yet (`export {};`) — its purpose is to
make the boundary importable and give TypeScript a module entry point. A single JSDoc
line on each file records its architectural role, matching `context/architecture-context.md`
(System Boundaries table). No sub-directories yet; each slice creates its own.

**Test scenarios:**
- `Test expectation: none` — pure scaffolding; no behavior to assert.

**Verification:** `npm run typecheck` still passes with the new files present;
`import {} from '@/shared'` resolves without a TypeScript error.

---

### U3. Zod env validation

**Goal:** Required environment variables are validated at build time; a missing or
invalid var causes a clear Zod error before the first request is served.

**Requirements:** R4

**Dependencies:** U1, U2

**Files:**
- `shared/env.ts` — Zod schema; exports typed `env` object
- `next.config.ts` — `import './shared/env'` at the top to trigger validation (relative path; `@/` may not resolve in config files)

**Approach:** Install `zod`. Define two schema buckets:

- `serverSchema` — server-only vars (never accessible in the browser): starts with
  `NODE_ENV: z.enum(["development", "test", "production"])`. Future slices add
  `SUPABASE_URL`, `BETTER_AUTH_SECRET`, OAuth secrets, etc. here.
- `clientSchema` — `NEXT_PUBLIC_` vars (safe to expose): empty for S1; `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  lands here in S4.

Merge the two schemas and call `.parse(process.env)`. Export the typed result as `env`.
Import the module from `next.config.ts` (`import '@/shared/env'`) so validation runs
on every `next build` and `next dev` invocation. Avoid wrapping in `try/catch` — Zod's
default error message is sufficient and a caught error would silently swallow the key name.

**Test scenarios:**
- All required vars present → `env` object has the correct types and values
- A required var removed → `ZodError` thrown with the key name in the message
- `NODE_ENV` set to `"staging"` → rejected (not in the allowed enum)

**Verification:** Temporarily unset `NODE_ENV` and run `next dev` locally → fails
fast with a Zod error naming the missing key. (Note: Vercel always injects `NODE_ENV`,
so the deployed build passes without manual configuration.)

---

### U4. Logger capability composition root

**Goal:** Establish the capability composition-root pattern with a concrete,
zero-dependency logger so later slices have a working example to follow.

**Requirements:** R5

**Dependencies:** U2

**Files:**
- `shared/capabilities/logger.ts` — `Logger` interface
- `infrastructure/logger.ts` — `ConsoleLogger` implements `Logger`; exports `logger` singleton

**Approach:** The `Logger` interface defines three methods — `info`, `warn`, `error` —
each typed `(message: string, context?: Record<string, unknown>) => void`. `ConsoleLogger`
delegates to the matching `console.*` method, passing `context` as a second argument so
the browser/Node console renders it inline. Export a pre-constructed singleton from
`infrastructure/logger.ts` so callers do `import { logger } from '@/infrastructure/logger'`,
matching the composition-root wiring pattern in `context/architecture-context.md`.

**Patterns to follow:** `context/examples.md` — Capabilities section.

**Test scenarios:**
- `logger.info("msg", { key: "val" })` does not throw
- `logger.warn("msg")` (no context) does not throw
- `logger.error("msg", { err: "x" })` does not throw
- Assigning a `ConsoleLogger` instance to a `Logger`-typed variable compiles without error

**Verification:** All four scenarios pass and `npm run typecheck` remains clean.

---

### U5. CI pipeline and Vercel deployment

**Goal:** Pull requests run typecheck + lint + test automatically; the app is live at
a public Vercel URL.

**Requirements:** R3, R6

**Dependencies:** U1, U3

**Prerequisite:** The repo must be pushed to a GitHub remote before this unit can be
executed. Both GitHub Actions and Vercel's GitHub integration require a remote.

**Files:**
- `.github/workflows/ci.yml`
- `.env.example` — documents the env vars future slices will add to the Vercel dashboard

**Approach:**

*CI:* Three sequential steps — `npm run typecheck`, `npm run lint`, `npm run test`.
Use Node LTS. Cache `node_modules` on the `package-lock.json` hash. Omit the
`next build` step for now — Vercel's preview deploy (below) validates that; add
the build step to CI once preview builds are active if earlier failure detection is needed.

*Vercel:* Connect the GitHub repo via the Vercel dashboard (or `vercel link` + `vercel deploy`).
No env vars need to be set manually at S1 — `NODE_ENV` is injected by Vercel automatically.
Add `.env.example` now listing the vars coming in later slices so the Vercel env var panel is
populated incrementally rather than all at once:

```
# S4 — Auth + Database
SUPABASE_URL=
SUPABASE_ANON_KEY=          # NEXT_PUBLIC_ in actual .env
BETTER_AUTH_SECRET=

# S5 — Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# S6 — WHOOP
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=

# S8 — AI
AI_GATEWAY_API_KEY=
```

> **Human in the loop:** Connecting to Vercel and choosing the project name / URL slug
> is a dashboard action. Decide the slug before connecting — it becomes the production
> URL and is non-trivial to rename cleanly later.

**Test scenarios:**
- `Test expectation: none` — CI and deployment are operational, not unit-testable.

**Verification:**
- Open a PR → CI job appears and all three steps pass
- Break the smoke test in that PR → CI job fails (blocking merge requires branch protection enabled in GitHub settings — a separate dashboard step, not part of this unit)
- Visit the Vercel deployment URL in a browser → https://my-subscriptions-iota.vercel.app/

---

## Scope boundaries

### In scope
- Vitest + Zod + companion packages (installation and configuration)
- System boundary directory scaffolding
- Zod env validation with server / `NEXT_PUBLIC_` split seam
- Logger capability composition root
- GitHub Actions CI
- Initial Vercel deployment

### Out of scope
- shadcn/ui component library setup (S2, when the report UI is built)
- Playwright e2e test setup (deferred — no user flow to test until S2+)
- Database, auth, and AI capability roots (S4 and S8 respectively)
- Any feature code or user-visible pages beyond the scaffold placeholder

### Deferred to follow-up work
- Structured logging library (pino, winston) — revisit if console output proves inadequate in production
- Per-boundary path aliases in `tsconfig.json` — defer until deep import paths become a readability problem
- `next build` step added to CI — add once Vercel preview URLs are active
