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
  `DaySummary`), including the cycle → UTC-date mapping and rule-based event
  categorization. Compute activity allocation, schedule-fragmentation metrics, and
  activity↔recovery correlations with sample size `n` and uncertainty. Replace the
  fixture's numbers with real computed metrics.
- **Mocked:** AI insight section still stubbed.
- **Demo milestone:** real numbers and charts from real data.
- **See also:** full data-flow chain and tier gating in S7–S9 shared notes.

#### Normalization layer (internal, not exported)

```ts
// internal — modules/report/normalize.ts

type WhoopDaySignal = {
  date: string           // YYYY-MM-DD in UTC (see Decisions — Timezone)
  recovery: number | null
  sleepHours: number | null
  strain: number | null
}

type CalendarDaySignal = {
  date: string
  activities: Record<string, number>  // category → hours
  eventCount: number
}
```

**WHOOP normalization rules** (all from spike findings):
- Join hub: `recovery.cycle_id → cycle`, `sleep.cycle_id → cycle`
- Date: `new Date(cycle.start)` → extract UTC date as YYYY-MM-DD (ignore `timezone_offset` for MVP)
- Filter: `score_state === "SCORED"` on both cycle and recovery; `nap === false` on sleep
- `sleepHours`: `(total_in_bed_time_milli - total_awake_time_milli) / 3_600_000`
- Double-cycle days: take the cycle with the latest `cycle.start` (after nap filtering)
- In-progress cycle (`end: null`): skip

**Calendar normalization rules:**
- All-day events: `start.date` present → duration = 1 day, assign to that date
- Timed events: `start.dateTime` → parse as UTC, assign to UTC date (ignore `start.timeZone` for MVP)
- Filter: `status !== "cancelled"`
- Categorize by event title → keyword rules → category → accumulate hours
- Initial categories: Work · Exercise · Family · Social · Learning · Travel · Personal · Rest

#### Evidence packet (S7 constructs, S8 consumes)

Do not send all 30 `DaySummary` rows to the AI — that bloats tokens and invites
re-derivation. Send pre-computed metrics + a small number of named exemplar days +
the candidate signals S7 already identified.

```ts
// modules/report/evidencePacket.ts

type CandidateSignal = {
  description: string   // e.g. "Exercise days show +9.2% recovery (n=14, strong)"
  n: number
  deltaPercent: number
  confidence: "strong" | "weak" | "insufficient"
}

type EvidencePacket = {
  window: { start: string; end: string; days: number }
  coverageDays: number
  connectedSources: ConnectedSource[]
  metrics: AnalysisMetrics
  exemplarDays: {
    highest: { date: string; recovery: number; activities: Record<string, number> }
    lowest:  { date: string; recovery: number; activities: Record<string, number> }
  } | null                // null when health not connected
  weekStats: Array<{
    label: string         // "Best week" / "Worst week"
    dateRange: string     // "Jun 2–8"
    recoveryPercent: number  // deterministic avg — AI fills in the prose summary
  }>
  candidateSignals: CandidateSignal[]
}
```

### S8. AI insight generation + persistence
- **Goal:** Vercel AI SDK behind the AI capability. Feed the evidence packet from S7
  (never raw events) into the model with the five techniques (competing hypotheses,
  skeptical self-critique, falsifiable recommendations, license to find nothing,
  calibrated confidence). Schema-validate AI output before it reaches state. Introduce
  the `reports` table and persist the first real report.
- **Mocked:** nothing — report is now fully real and stored in database.
- **Demo milestone:** the complete real report.
- **See also:** full data-flow chain and S7 → S8 seam in S7–S9 shared notes; evidence packet constructed in S7.

#### AI output sub-contract

The AI emits *only* these fields, validated against a narrow sub-schema before
being merged with the deterministic fields (Invariant #7):

```ts
// shared/schemas/report.ts — add alongside reportSchema

export const aiOutputSchema = z.object({
  executiveSummary: z.string().min(1).max(2000),
  weekHighlightSummaries: z.array(z.string()),  // one per weekStats entry, in order
  findings: z.array(findingSchema).min(0).max(5),
})
```

The assembled `weekHighlights` merges deterministic stats with AI prose:

```ts
weekHighlights: weekStats.map((w, i) => ({
  ...w,
  summary: aiOutput.weekHighlightSummaries[i] ?? "",
}))
```

#### Report persistence

New `reports` table, introduced in this slice. One row per user, upserted on every
generation run.

```sql
CREATE TABLE reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 text NOT NULL REFERENCES users(id),
  data                    jsonb NOT NULL,
  window_start            date NOT NULL,
  window_end              date NOT NULL,
  generated_at            timestamptz NOT NULL,
  integration_snapshot_at timestamptz NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reports_user_id_idx ON reports (user_id);
```

`integration_snapshot_at` = `max(updated_at)` across all integration rows at
generation time. S9's staleness detection compares this on every report read.

```ts
interface ReportRepository {
  getReport(userId: string): Promise<StoredReport | null>
  saveReport(userId: string, report: Report, integrationSnapshotAt: Date): Promise<void>
}

type StoredReport = {
  report: Report
  integrationSnapshotAt: Date
}
```

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
- **See also:** full data-flow chain and tier gating in S7–S9 shared notes; `ReportRepository` introduced in S8.

#### Staleness detection + pipeline trigger

```ts
type ReportStatus =
  | { status: 'current'; report: Report }
  | { status: 'needs_generation'; reason: 'no_report' | 'window_drift' | 'integration_changed' }

function checkReportStatus(
  stored: StoredReport | null,
  currentIntegrationAt: Date,
  windowEndExpected: string,  // the end date a current 30-day window should have
): ReportStatus {
  if (!stored)
    return { status: 'needs_generation', reason: 'no_report' }
  if (stored.report.window.end !== windowEndExpected)
    return { status: 'needs_generation', reason: 'window_drift' }
  if (currentIntegrationAt > stored.integrationSnapshotAt)
    return { status: 'needs_generation', reason: 'integration_changed' }
  return { status: 'current', report: stored.report }
}
```

`currentIntegrationAt` must also move when calendar selections change — either
update the integration row's `updated_at` on selection change, or store a
separate `lastSelectionChangedAt` per user.

**Concurrent regeneration guard:** `saveReport` must be an upsert keyed on
`user_id`. Two tabs opening on a new day will both detect drift and race to
generate; the upsert ensures only one report row exists and the second write
simply overwrites the first. Consider a short-circuit: if a report row was
written within the last N seconds, skip re-generation.

### S10. Polish — generation, then UI
- **Goal:** Per the user's stated order. First tune AI generation quality (prompts,
  the five techniques, calibration, "find nothing" behavior). Then visual/interaction
  polish on the report screens.
- **Demo milestone:** launch-quality report.

---

## S7–S9 shared notes

Recorded after an architecture review (2026-06-22). Contains only cross-cutting
context that spans multiple slices. Per-slice detail lives in each slice above.

### Full data-flow chain

```
fetchEventsForWindow(userId)          →  RawCalendarEvent[]
fetchRawDataForWindow(userId)         →  WhoopRawData { cycles, sleeps, recoveries }
         ↓
normalizeCalendarEvents()             →  CalendarDaySignal[] (date → { activities, eventCount })
normalizeWhoopCycles()                →  WhoopDaySignal[]   (date → { recovery, sleepHours, strain })
         ↓
joinSignals()                         →  DaySummary[]       (common timeline spine)
         ↓
computeMetrics(daySummaries)          →  AnalysisMetrics    (n + confidence per delta)
identifyCandidateSignals()            →  CandidateSignal[]  (notable patterns; AI interprets these)
         ↓
buildEvidencePacket()                 →  EvidencePacket     (compact; never raw events)
         ↓
generateInsights(evidencePacket)      →  { executiveSummary, weekHighlightSummaries, findings }
         ↓
assembleReport() → reportSchema.parse() → upsert into reports table → return Report
```

The two provider fetches are independent and must run in parallel. The AI call is
the final blocking step; everything before it is deterministic.

### S7 → S8 seam — candidate signals, not findings

S7 enumerates *candidate signals* (notable deltas with n + uncertainty); S8's AI
decides which candidates become findings and may surface zero (Technique 4).
S7 does not know what findings will result — it knows what the data shows.

### Tier gating — safety boundary, not UX rule

Connection tier (one source vs. two) must be decided *before* fetch and must
control which metrics are computed and what the AI prompt contains.

- **Calendar only:** skip WHOOP fetch; compute activity metrics only; AI prompt
  must not reference health or cross-source relationships.
- **WHOOP only:** skip Calendar fetch; compute recovery/sleep trends only; AI
  prompt must not reference schedule or cross-source relationships.
- **Both:** full pipeline; cross-source correlations and AI relationship framing
  are enabled.

Running cross-service correlation interpretation with only one source
manufactures a relationship from nothing — a direct Technique 4 violation. The
gate is on computation and the AI prompt, not only on display.

---

## Risks to watch (across slices)

- **Synchronous-pipeline latency** (S9) — retrieve+normalize+metrics+AI must fit
  the request budget. Vercel Hobby cap is 60 s; Pro is 300 s — name and document
  the actual ceiling before S9 lands. Validate end-to-end latency the moment S7
  and S8 exist, not at the end.
- **Google verification lead time** — parallel track; gates real (non-dev) users.
- **Report-contract churn** — mitigated by designing the contract at S2–S3 against
  S7–S8 output shapes. One known amendment needed pre-S7: see Open Decisions #1.
- **Spike open-questions** (all-day events, recurring expansion, large-window
  multi-calendar pagination) — resolve when S5 is planned.
- **Concurrent regeneration** (S9) — two browser tabs opening on a new day both
  detect drift; guard with upsert semantics and a short-circuit on recent writes.

---

## Decisions (resolved 2026-06-22)

### Decision 1 — `activityRecoveryDeltaSchema` amendment ✅

`n` and `confidence` fields added to the schema. This is the only amendment to
the contract locked at S3.

### Decision 2 — Timezone ✅

**Use UTC for the MVP.** Do not derive timezone from any integration — that would
couple date bucketing to whichever provider happens to be connected. The report
covers a rolling 30-day window the user never selects manually, so exact timezone
alignment is low-stakes for now. All date strings (`DaySummary.date`, window
start/end, cycle→date mapping, event→date bucketing) are UTC.

If per-user timezone is ever needed: add a `timezone` column to the `users` table
at that point and update the normalization layer — no other layer changes.

### Decision 3 — Vercel function timeout ✅

Deferred. Build the pipeline first; measure end-to-end latency when S7 and S8
exist; optimize only if latency exceeds the request budget in practice.

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
