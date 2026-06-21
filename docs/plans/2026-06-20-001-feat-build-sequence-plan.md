---
title: "feat: MySubscriptions MVP build sequence (vertical slices)"
date: 2026-06-20
type: sequence
depth: lightweight
origin: docs/brainstorms/mvp.md
status: active
---

# feat: MySubscriptions MVP build sequence (vertical slices)

## Summary

A high-level **sequencing plan** for building the MySubscriptions MVP as vertical
slices, optimized for: a working demo as early as possible, low integration risk,
and polish last. This is a roadmap, not a task breakdown — each slice is planned in
detail when we reach it.

The spine of the approach is **progressive mock-replacement**: stand up the full
report UI against a hardcoded fixture first (earliest compelling demo), then swap
mock → real underneath it one slice at a time (API seam → auth → providers →
deterministic metrics → AI), so the report's shape is proven before any backend
exists and every later slice is a fill-in rather than a reshape.

This plan defines slice boundaries, ordering, demo milestones, and the few
decisions/risks that span slices. It deliberately omits per-slice file lists and
test scenarios — those are produced when each slice is planned.

---

## Sequencing principles

- **Demo-first.** The report screens are the product's "wow." Build them against a
  fixture before anything real exists, so there is a showable artifact from slice 1.
- **Mock the backend, swap it later.** Every slice replaces one mock with a real
  implementation behind the same contract/capability interface — never a reshape.
- **Vertical slices, not layers.** Each provider is built OAuth + retrieval +
  persistence as a single end-to-end slice, so one provider works fully before the
  second starts (and the second reuses the first's capability pattern).
- **Retire external-lead-time risk in parallel, early.** Google OAuth app
  verification has calendar lead time independent of code — kick it off up front.
- **Polish last**, in the user's stated order: generation quality, then UI.

---

## Parallel / up-front tracks (not slices)

These run alongside the slices below; start them at day 1, not when their slice lands.

- **Google OAuth app verification.** Calendar scopes are sensitive (spike-confirmed);
  Google verification has external lead time. Submit early so it isn't the gating
  item near launch. Until verified, dev re-consents weekly (7-day refresh-token
  expiry in "Testing").
- **Seed a dedicated Work calendar** in the Google account (recurring meetings, focus
  blocks, 1:1s) so Calendar produces realistic meeting-load signal for demos and
  metrics validation. (Per brainstorm Data Strategy.)
- **WHOOP real data** is already available — no seeding needed.

---

## Cross-slice decisions (decide at the slice noted, don't drift)

- **Report data contract — design once, at Slice 1–2.** The whole approach hinges on
  the report's shape staying stable while mock → real swaps underneath. Design the
  contract (Zod schema in `shared`) against what Slices 6–7 will actually emit —
  `DaySummary`, the per-finding evidence packet, and the `Finding` shape (competing
  hypotheses, confidence, "what would change my mind"). If this churns later, every
  slice churns. (origin: docs/brainstorms/mvp.md — Domain Model, AI Insight Design.)
- **Tenancy — decide at Slice 3, before the first migration.** Expensive to reverse
  (`architecture-context.md` → Cost to Reverse). Even though multi-user is out of
  scope, scope every query by `user_id` at the repository layer from the first
  migration. Don't discover this later.
- **Integration capability shape — set at Slice 4, reused at Slice 5.** OAuth token
  storage + refresh + retrieval live behind a Calendar/Health capability interface,
  not vendor SDKs in feature code. Slice 4 establishes it; Slice 5 conforms to it.

---

## Build sequence

### S1. App shell + foundation + deploy
- **Goal:** `create-next-app` (strict TS), system boundaries (`app` / `frontend` /
  `modules` / `infrastructure` / `shared`), lint + typecheck + test + CI, Zod env
  validation, capability composition-root stubs. **Deploy to Vercel now** to retire
  deployment integration risk on day 1.
- **Mocked:** everything below the shell.
- **Demo milestone:** deployed, reachable empty app.

### S2. Report page — hardcoded fixture
- **Goal:** Build all three report screens (Executive Summary; Analysis Dashboard
  with inspectable charts; AI Insight cards) against a hardcoded `Report` fixture.
  This is the earliest compelling demo and the design forcing-function for the
  contract.
- **Mocked:** the entire `Report` (inline fixture), no server, no auth.
- **Demo milestone:** the full report visual, end to end, frontend-only.

### S3. Report API — establish the seam
- **Goal:** Define the `Report` contract (Zod, in `shared`) and serve the fixture
  from a thin route/server action → service. Frontend fetches from the API instead of
  inline mock. Backend still returns the fixture.
- **Mocked:** the report *contents* (service returns the fixture).
- **Demo milestone:** report served over the API, contract locked.

### S4. Auth foundation — Supabase + Better Auth + Google social login
- **Goal:** Supabase (Postgres) + Drizzle + Better Auth capability + Google social
  login (**identity only** — not a data connection). Gate the report behind a
  session. **Decide tenancy here** (see cross-slice decisions) — first migration.
- **Mocked:** report contents still the fixture, now per authenticated user.
- **Demo milestone:** sign in with Google → see the (still-mock) report.

### S5. Calendar provider — OAuth + retrieval + persistence selected calendar
- **Goal:** Connect Google Calendar via OAuth (separate consent from identity login;
  `access_type=offline` + `prompt=consent`), 
- After connection user selects at least one calendar. Owned-calendar selection (primary
  pre-selected), token storage + serialized refresh, retrieve events. Selected calendar
  persisted in CalendarSelection table.
- **Mocked:** the analysis layer still uses the fixture; surface retrieved data in a
  minimal debug view only. Raw data now available in memory but not stored in database.
- **Demo milestone:** real Calendar data connected, retrieved per user.
- **Risk/notes:** 7-day dev re-consent loop (verification track mitigates for real
  users); revisit spike open-questions (all-day events, recurring-series expansion,
  multi-calendar pagination at scale) when this slice is planned.

### S6. WHOOP provider — OAuth + retrieval
- **Goal:** Same pattern as S5, conforming to the capability set there. WHOOP OAuth
  (form-urlencoded token exchange, rotating refresh — serialize server-side),
  retrieve Cycles / Recovery / Sleep.
- **Mocked:** analysis layer still fixture-backed; both providers' raw data now available 
  in memory but not stored in database.
- **Demo milestone:** both real sources connected.
- **Risk/notes:** join on `cycle_id` not index; gate on `score_state === "SCORED"`;
  filter naps — carry spike findings into the detailed plan.

### S7. Deterministic layer — normalization + metrics + correlations
- **Goal:** Normalize raw provider data into the common timeline (Signal →
  `DaySummary`), including the **cycle → local-date mapping** (bucket by local date of
  `cycle.start`, decide double-cycle days on purpose) and rule-based event
  categorization. Compute activity allocation, schedule-fragmentation metrics, and
  activity↔recovery correlations **with sample size `n` and uncertainty**. Replace the
  fixture's numbers with real computed metrics.
- **Mocked:** AI insight section still stubbed.
- **Demo milestone:** real numbers and charts from real data.

### S8. AI insight generation + persistence
- **Goal:** Vercel AI SDK behind the AI capability. Build the per-finding evidence
  packet from the deterministic layer (never raw events) and generate insights with
  the five techniques (competing hypotheses, skeptical self-critique, falsifiable
  recommendations, license to find nothing, calibrated confidence). Schema-validate
  the `Finding` output before it reaches state. Replace mock insights with real AI.
- **Mocked:** nothing — report is now fully real are stored in database.
- **Demo milestone:** the complete real report.

### S9. Pipeline assembly + automatic generation
- **Goal:** Wire retrieve → normalize → metrics → AI to run **synchronously within
  the request** (invariant #6 — no queue/cron). Implement automatic generation /
  regenerate-on-window-drift / regenerate-on-integration-change, one-report-per-user
  overwrite, loading states, and connection-tier gating (single-source view vs.
  two-source correlations + relationship framing).
- **Demo milestone:** the real automatic product flow — no "generate" button.
- **Risk/notes:** **synchronous-pipeline latency** is the main remaining integration
  risk and can't be exercised until S7–S8 land. Validate the end-to-end latency
  against the request budget the moment those slices exist, not at the end.

### S10. Polish — generation, then UI
- **Goal:** Per the user's stated order. First tune AI generation quality (prompts,
  the five techniques, calibration, "find nothing" behavior). Then visual/interaction
  polish on the report screens.
- **Demo milestone:** launch-quality report.

---

## Risks to watch (across slices)

- **Synchronous-pipeline latency** (S9) — retrieve+normalize+metrics+AI must fit the
  request budget; validate as soon as S7–S8 land.
- **Google verification lead time** — parallel track; gates real (non-dev) users.
- **Report-contract churn** — mitigated by designing the contract at S2–S3 against
  S7–S8 output shapes.
- **Spike open-questions** (all-day events, recurring expansion, large-window
  multi-calendar pagination) — resolve when S5 is planned.

---

## Scope boundaries

- **This plan covers** sequencing and slice boundaries only. Per-slice file lists,
  data-model details, and test scenarios are produced when each slice is planned.
- **Out of scope** (per origin): additional providers, causal claims, multi-identity
  / multi-tenant user support, report history/versioning.

---

## Notes

- Ordering differs from the user's initial list in four deliberate ways, all to serve
  the stated goals: (1) deploy at S1 to retire deployment risk early; (2) each
  provider is one end-to-end slice (OAuth + retrieval together) rather than split, for
  true vertical slicing; (3) normalization is called out as part of the deterministic
  layer (S7) rather than implied; (4) an explicit pipeline-assembly + auto-generation
  slice (S9) carries the synchronous-pipeline invariant. Provider order is
  Calendar-first per the user's choice.
