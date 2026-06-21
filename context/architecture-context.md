# Architecture Context

## Stack

| Layer | Technology | AI Resource |
|---------|---------|---------|
| Framework | Next.js + TypeScript | https://nextjs.org/docs/llms.txt |
| UI | TailwindCSS + shadcn/ui | https://ui.shadcn.com/llms.txt |
| Database | Supabase (Postgres) | https://supabase.com/llms.txt |
| ORM | Drizzle | https://orm.drizzle.team/llms.txt |
| Auth | Better Auth | https://better-auth.com/llms.txt |
| AI | Vercel AI SDK | https://ai-sdk.dev/llms.txt |
| Validation | Zod | |
| Testing | Vitest + Playwright | |
| Deployment | Vercel | vercel.com/docs/llms.txt  |

---

## High-level architecture & design

See `High-level architecture & design` in `README.md`

---

## Core Principle

One idea underpins this architecture: **depend on abstractions you own, never on
concrete vendors or frameworks.** Dependency inversion, applied at every boundary.

Feature code should not know whether the database is Postgres, the auth is Better
Auth, or the model comes from the Vercel AI SDK. It depends on an interface; the
`infrastructure` layer provides the implementation. This is what keeps an MVP cheap
to change and able to grow into production without a rewrite.

The three pillars below are this single principle applied at three boundaries.

---

## Pillars

### 1. One-directional layering

The principle applied to business logic: a service sits behind every route.

```txt
Frontend → route / server action → service → repository → infrastructure
```

- **Routes and server actions are thin.** Validate input, call a service, shape the response. Nothing else.
- **Business rules live in services**, in `modules`, independent of Next.js and any vendor.
- **Dependencies point inward.** Inner layers never import outer ones.

**Designs out:** the handler that does everything — validation, business logic, DB
calls, and response shaping in one function. It can't be tested without HTTP, can't
be reused, and splitting it later is a painful refactor. Establish the seam in the
first feature, not the tenth.

### 2. Depend on capabilities, not vendors

The principle applied to infrastructure: every external concern is consumed through
a capability interface.

- The application **owns the interface** (in `modules` / `shared`).
- `infrastructure` **provides the implementation**, injected at the edge.
- **Feature code never imports a vendor SDK.**

Capabilities include database, auth, storage, AI, email, logging, analytics, and
feature flags. The **repository is simply the database capability** — the same
pattern as all the others.

Auth is a capability like the rest: Better Auth is the default provider and already
spans email, OAuth/social, and passkeys behind one interface, so changing *login
methods* is a provider concern, not a feature-code change.

```ts
// feature code depends on the capability, not the vendor
logger.info("Task created", { taskId });
featureFlags.isEnabled("new_dashboard");
await storage.upload({ path, file });
```

**Why:** swappability (change provider without touching features), testability
(inject a stub — see `examples.md`), reversibility, and isolation from infra churn.

**Designs out:** a vendor SDK imported directly into a feature, so that swapping it
or testing around it means editing business logic.

### 3. Modular monolith

The principle applied to the system itself: one deployable unit with explicit
internal module boundaries — not premature microservices.

Draw boundaries **by domain**, not by technical layer — one module per domain concept,
not one per pattern. Prefer **deep modules**: substantial functionality behind a small,
stable interface, rather than shallow wrappers whose interface is as wide as their
implementation. (This is the same shape capability interfaces take: a small surface over
a deep, swappable body.)

Extract a service only when scale or ownership forces it, and preserve the existing
interfaces when you do. Because features already depend on interfaces (pillars 1 and
2), extraction becomes a deployment change rather than a rewrite.

**Designs out:** a flat, tangled codebase with no internal seams, where every feature
reaches directly into every other.

---

## Restraint

The pillars are cheap seams, not speculative flexibility — apply them, then stop.

- Build the simplest thing that satisfies the pillars. A capability interface with one
  trivial implementation is the right amount; a plugin system for providers you don't
  have is not.
- Add structure for boundaries that exist, not ones you imagine: no interface without a
  caller, no module split without a second consumer, no provider before its need is proven.
- Reach for a new pattern only after the existing one demonstrably fails.

---

## Wiring

The pillars need a place where interfaces meet implementations. Keep it manual — no DI
container (they fight Next.js and add ceremony an MVP doesn't need).

- **Services take their dependencies as explicit parameters** — `createTask(input,
  repository)`. That parameter *is* the injection point, and it's what lets a service be
  tested with a stub.
- **Each capability is constructed in a composition-root module under `infrastructure/`**
  that exports a configured concrete instance (`infrastructure/logger.ts` → `logger`).
- **The edge wires it up.** The route or server action imports the concrete
  implementation and passes it inward; inner layers never construct their own infra.

---

## AI Boundary

These are web apps with an LLM capability, so the trust boundary is explicit:
**AI output is never the system of record, and never becomes truth without validation.**

- Deterministic systems own state and data processing.
- AI reasons over structured inputs; its outputs are validated or constrained (schema,
  bounds, allow-lists) before they affect state.
- Feeding raw data to an LLM is fine when that *is* the product — extraction,
  classification, RAG. What is banned is letting an inference silently become the source
  of truth.

---

## Decisions by Cost to Reverse

Weigh decisions by how expensive they are to undo, and invest design attention
accordingly. As a rule, the lower down the stack, the harder to change.

- **Cheap to reverse** — providers behind a capability interface (logging, email,
  storage, even auth). Decide fast; the interface keeps the blast radius small.
- **Expensive to reverse** — data model, schema, tenancy boundaries. Data outlives code,
  and a capability interface does *not* make the model underneath swappable. Design these
  deliberately, up front. In particular, **decide tenancy before the first migration**; if
  the app is multi-tenant, enforce the tenant boundary at the **repository layer** — every
  query scoped by tenant id, never trusting the caller.

---

## System Boundaries

Where code physically lives.

| Boundary | Contents |
|---|---|
| `app` | Next.js routes, server actions, API endpoints. |
| `frontend` | UI components, pages, forms, tables, charts, client interactions. |
| `modules` | Application services, business rules, domain logic, repository interfaces. |
| `infrastructure` | Implementations: database, auth, storage, AI, logging, analytics, external integrations. |
| `shared` | Types, validation schemas, shared utilities. |

---

## Invariants

Checkable rules — a reviewer, or a grep, can enforce them.

1. Routes and server actions are thin; business logic lives in services, not routes or components.
2. Input is validated at system boundaries (see `code-standards.md`).
3. Authentication and authorization are enforced before mutations.
4. Data access goes through repository interfaces, not the ORM directly.
5. Feature code does not import vendor SDKs; infrastructure stays behind capability interfaces.
6. Report generation runs synchronously within the request — no job queue or cron in
   the MVP. (Revisit if generation latency outgrows the request budget.)
7. AI output is validated or constrained before it affects state; AI is never the system of record.
