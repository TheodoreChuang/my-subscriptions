---
title: "feat: S2 — Report page, hardcoded fixture"
date: 2026-06-20
type: feat
depth: standard
origin: docs/plans/2026-06-20-001-feat-build-sequence-plan.md
status: draft
---

# feat: S2 — Report page, hardcoded fixture

## Summary

Builds all three report screens — Executive Summary, Analysis Dashboard (with
a Recharts bar chart), and AI Insight cards — against a hardcoded `Report`
fixture. This is the earliest compelling demo and the design forcing-function for
the data contract that every later slice (`S3`–`S8`) must conform to.

**No server, no auth, no API.** The full report UI renders from a fixture imported
directly into the route. The fixture uses the both-sources scenario (Calendar +
WHOOP) to show the complete product.

**This slice also installs shadcn/ui** (deferred from S1 per the S1 plan) and
designs the `Report` data contract — a cross-slice decision from the build sequence
plan that must stay stable from S3 onward.

**Demo milestone (S2):** the full report visual, end to end, app-only.

---

## Problem Frame

S1 delivered a deployed, empty app. S2 answers: "what does the product actually
look like?" The report screens are the product's "wow" — three sections that
together tell the user what their month meant. Building them against a fixture
first proves the UI and locks the data contract before any real backend work
begins. Every future slice swaps one layer; none of them should reshape the
contract.

---

## Requirements

Drawn from S2 in the build sequence (see origin) and `context/ui-report-page.md`:

- R1: All three report sections render at `/report` from a hardcoded `Report` fixture.
- R2: Executive Summary section shows: headline, AI-generated narrative paragraph
  (`report.executiveSummary`), integration-source status, time allocation breakdown,
  and best/worst week highlights.
- R3: Analysis Dashboard section shows: 6-stat KPI grid, time-allocation breakdown
  (Tailwind bars), and activity↔recovery delta horizontal bar chart (Recharts).
- R4: AI Insights section shows: finding count + data days, and renders each `Finding`
  as a typed card (finding / surprise / experiment) with confidence badge, description,
  and always-visible alternative explanation.
- R5: The `Report` type and its Zod schema live in `shared/` and are stable enough
  for S3 to lock the API seam against them (cross-slice decision from origin).
- R6: `'use client'` is applied only to chart leaf components; all section-level
  components are Server Components.
- R7: shadcn/ui Card, Badge, and Chart components are installed and used.
- R8: `app/layout.tsx` metadata title is updated from the `create-next-app` default.

---

## Key Technical Decisions

**KTD1 — shadcn/ui with Recharts for charts; `components/ui/` at repo root is an accepted exception.**
shadcn's Chart component wraps Recharts and provides consistent theming via CSS
variables. Install shadcn (`npx shadcn@latest init`), then add the Card, Badge, and
Chart components (`npx shadcn@latest add card badge chart`). Install `recharts` and
`lucide-react` directly — shadcn's Chart component requires recharts as a peer dep and
the lucide icons are referenced by name throughout the UI context. Recharts components
are client-only (they use DOM APIs), so chart leaf components must be `'use client'`.

When running `shadcn init`, configure `components.json` to output to `components/ui/`
(the default) rather than `app/`. The `@/components/ui/` and `@/lib/utils` paths
are an accepted exception to the `app/` boundary — shadcn's `cn` helper is
imported by every generated component, so re-pathing after init causes more churn than
it prevents. Feature components that consume shadcn primitives live in `app/`
as normal; the `components/` directory holds only auto-generated shadcn output. Capture
this exception in the plan (here) so the boundary isn't silently violated later.

**KTD2 — Report data contract designed here, stable through S3–S8.**
The build sequence plan's primary risk is contract churn: "if this churns later,
every slice churns." Design the `Report` Zod schema against what S7 (deterministic
layer) and S8 (AI) will actually emit — not just what the fixture needs today.
Key decisions within the contract:

- `Report.coverageDays` is the count of days for which data was actually recorded,
  distinct from `window.days` (the 30-day window size). The wireframe Insights header
  reads "26 days of data" over a 30-day window because WHOOP data only exists for 26
  of those 30 nights. `coverageDays` = `daySummaries.length` — the fixture must set
  26 `daySummary` entries, not 30. This field drives the Insights header text in S2
  and the loading-state copy in S9 ("Crunching N nights of data").
- `Finding.n` is a per-finding sample size, separate from both `window.days` and
  `coverageDays`. A correlation finding may be computed over fewer days than actual
  coverage (e.g., only days with high-work *and* recovery data). The wireframe shows
  "Consistent · n=26" on a confidence badge. Include `n?: number` on `Finding`.
- `Finding.experiment` carries three fields: `instruction` (what to do), `expectedSignal`
  (what success looks like / what the user should observe), and `killCondition` (when
  to stop). The brainstorm's falsifiable-experiment technique requires all three.
- `Finding.alternativeExplanation` is required (not optional). The wireframe shows
  "⚠ ALTERNATIVE" as a permanently visible caveat on every card — it is a core
  product invariant, not an optional annotation.
- `AnalysisMetrics` includes both Calendar-only fields (events, categories, schedule
  fragmentation) and WHOOP-only fields (recovery, strain, cycles), plus correlation
  fields (`activityRecoveryDeltas`) that require both sources. This allows the
  connection-tier gating in S9 to conditionally render sections without changing the
  type.

**KTD3 — `'use client'` boundary at chart leaf components only.**
Chart components (`ActivityDeltaChart.tsx`) are the only
components that need DOM APIs. Section-level components (`AnalysisSection.tsx`,
`SummarySection.tsx`, `InsightsSection.tsx`) and the page container (`ReportPage.tsx`)
are Server Components. This maximizes RSC rendering surface and keeps the boundary
as narrow as possible (see `context/code-standards.md`).

**KTD4 — Report route at `/report`, not `/`.**
Home (`/`) will eventually be the integrations/connection page (see build sequence).
The report is at `/report`. In S2, `app/page.tsx` redirects to `/report` for
convenience — this redirect is removed in S4 when the home page becomes the auth/
connection entry point.

**KTD5 — Fixture uses both-sources scenario; `daySummaries` carried for S7 forward-compat.**
The fixture sets `connectedSources: ["calendar", "health"]` to demo the full product.
Charts in S2 draw from aggregate `metrics` fields (not per-day `DaySummary`), because
per-day trend charts only become meaningful with real data (S7). `daySummaries` is
present in the contract and fixture (populated with representative data) so S7 can
replace the fixture at the service layer without a type change.

---

## Implementation Units

### U1. shadcn/ui + Recharts installation

**Goal:** shadcn/ui is initialized, Card + Badge + Chart components are added, and
`recharts` + `lucide-react` are installed. The project builds and typechecks cleanly.

**Requirements:** R7

**Dependencies:** none

**Files:**
- `components/ui/card.tsx` — added by shadcn
- `components/ui/badge.tsx` — added by shadcn
- `components/ui/chart.tsx` — added by shadcn
- `lib/utils.ts` — added by shadcn (`cn` helper)
- `app/globals.css` — shadcn init extends this with CSS variable tokens
- `components.json` — shadcn config (created by init)
- `package.json` — adds `recharts`, `lucide-react`

**Approach:** Run `npx shadcn@latest init` (chooses default style, base color, CSS
variables). Then `npx shadcn@latest add card badge chart`. Install `recharts` and
`lucide-react` as direct dependencies (`npm install recharts lucide-react`). Verify
`npm run typecheck` passes — shadcn components ship with types; no manual type installs
needed.

> **Note on Next.js version:** Read `node_modules/next/dist/docs/` for any shadcn
> integration notes specific to Next.js 16.2.9 before running init. The shadcn CLI
> auto-detects Next.js but confirm the generated config is correct for this version.

**Test scenarios:**
- `npm run typecheck` exits 0 after installation
- `npm run build` exits 0 (no missing peer deps, no resolution errors)
- Importing `{ Card, CardContent }` from `@/components/ui/card` in a server component
  does not produce a TypeScript error

**Verification:** All three pass locally; `components.json` exists at repo root.

---

### U2. Report data contract + fixture

**Goal:** The canonical `Report` TypeScript types and Zod schemas live in `shared/`,
and a realistic hardcoded fixture covers the both-sources scenario.

**Requirements:** R5

**Dependencies:** none (Zod is already installed from S1; `shared/` exists from S1)

**Files:**
- `shared/schemas/report.ts` — Zod schemas (source of truth for shape; validates at API boundary in S3+)
- `shared/types/report.ts` — TypeScript types derived via `z.infer`; no hand-authored parallel definitions
- `app/report/fixture.ts` — hardcoded `Report` conforming to the types

**Approach:**

_Schemas (`shared/schemas/report.ts`):_ The source of truth for the data contract.
Author all `Report`-family definitions here as Zod schemas. The pseudocode below shows
the shape:

```
ConnectedSource = "calendar" | "health"
FindingType     = "finding" | "surprise" | "experiment"

Finding:
  id:                    string
  type:                  FindingType
  title:                 string
  description:           string
  alternativeExplanation: string          // always shown; required
  confidence:            "high" | "medium" | "low"
  n?:                    number           // per-finding sample size (may be < window.days)
  whatWouldChangeMind?:  string
  experiment?:
    instruction:     string               // what the user should do
    expectedSignal:  string               // what success looks like
    killCondition:   string               // when to stop

WeekHighlight:
  label:           string                 // e.g. "Best week"
  dateRange:       string                 // e.g. "Jun 2–8"
  recoveryPercent: number
  summary:         string

CategoryAllocation:
  category:   string
  hours:      number
  percent:    number

ActivityRecoveryDelta:
  activity:     string
  deltaPercent: number

AnalysisMetrics:
  // Calendar-sourced (present when connectedSources includes "calendar")
  totalEvents?:            number
  totalScheduledHours?:    number
  topCategories?:          CategoryAllocation[]
  busiestDay?:             string        // ISO date

  // WHOOP-sourced (present when connectedSources includes "health")
  avgRecovery?:            number        // percent
  avgStrain?:              number
  totalRecoveryCycles?:    number
  highRecoveryDays?:       number
  lowRecoveryDays?:        number

  // Correlation fields (present when both sources connected)
  activityRecoveryDeltas?: ActivityRecoveryDelta[]

DaySummary:
  date:        string                    // ISO date "YYYY-MM-DD"
  activities:  Record<string, number>   // hours per category; open shape supports the
                                        // full 8-category taxonomy S7 will emit
                                        // (work, exercise, family, social, learning,
                                        // travel, personal, rest) without a type change
  recovery?:   number                    // WHOOP recovery %
  sleepHours?: number
  strain?:     number

ReportWindow:
  start: string                          // ISO date
  end:   string
  days:  number
  label: string                          // e.g. "May 21 – Jun 20"

Report:
  window:           ReportWindow
  coverageDays:     number               // count of days with actual data (≤ window.days)
  connectedSources: ConnectedSource[]
  executiveSummary: string
  weekHighlights:   WeekHighlight[]
  daySummaries:     DaySummary[]         // length == coverageDays
  metrics:          AnalysisMetrics
  findings:         Finding[]
  generatedAt:      string               // ISO datetime
```

_Types (`shared/types/report.ts`):_ Re-exports TypeScript types derived from the Zod
schemas via `z.infer`. No hand-authored parallel type definitions — the schemas are
the single source of truth, making type-schema divergence structurally impossible.
Not called in S2 (fixture is imported directly as a typed constant annotated with the
inferred `Report` type), but must be present so S3 can import types without a separate
authoring step.

_Fixture (`app/report/fixture.ts`):_ A realistic `Report` constant with
`connectedSources: ["calendar", "health"]`, `window.days: 30` (rolling 30-day window),
`coverageDays: 26` (WHOOP data exists for 26 of those nights — matches the wireframe's
"26 days of data" and "Crunching 26 nights of data"), 3 findings (one each of type
`finding`, `surprise`, `experiment`), and metrics that match the wireframe numbers
(87 events, 30 cycles, 68% avg recovery, 12.4 avg strain, 8 high recovery days,
6 low recovery days). The `topCategories` field drives the Analysis Top Categories
display (Work 48%, Exercise 22%, Social 12%, other categories). The
`activityRecoveryDeltas` field drives the activity-delta chart and must include at
least one negative-delta entry. `daySummaries` is populated with **26** representative
entries (matching `coverageDays`).

**Test scenarios:**
- `findingSchema.parse(fixture.findings[0])` succeeds for all three finding types
- `reportSchema.parse(FIXTURE)` succeeds (full fixture is schema-valid)
- A `Finding` with `alternativeExplanation` omitted fails `findingSchema.parse()`
- A `Finding.experiment` with `expectedSignal` omitted fails schema parse
- `FIXTURE.daySummaries.length === FIXTURE.coverageDays` (26 entries, not 30)
- `npm run typecheck` exits 0 (fixture's type annotation catches contract drift)

**Verification:** All six pass; no TypeScript errors on the fixture file.

---

### U3. Report page shell

**Goal:** `/report` renders (a stub for now), `app/layout.tsx` carries the correct
product name, and `app/page.tsx` provides a convenience redirect to `/report`.

**Requirements:** R1, R8

**Dependencies:** U1, U2 (route imports the fixture and uses shadcn-based section components)

**Files:**
- `app/layout.tsx` — update `metadata.title` from `"Create Next App"` to `"MySubscriptions"`
- `app/report/page.tsx` — thin route; imports fixture; passes to `<ReportPage />`
- `app/report/ReportPage.tsx` — page container; receives `Report` prop; renders
  section scaffolding (Summary / Analysis / Insights)
- `app/page.tsx` — temporary redirect to `/report` (removed in S4)

**Approach:** `app/report/page.tsx` is a Server Component. It imports `FIXTURE` from
`@/app/report/fixture` and renders `<ReportPage report={FIXTURE} />`. The route
is thin — no data fetching logic belongs here (that comes in S3). `ReportPage.tsx` is
also a Server Component; it renders the three section components side by side in a
single-column layout. The redirect in `app/page.tsx` uses Next.js `redirect()` from
`next/navigation` (server-side, no client component needed).

**Test scenarios:**
- `GET /report` returns HTTP 200 (smoke: the route exists and renders without crashing)
- `app/layout.tsx` `metadata.title` equals `"MySubscriptions"`
- `npm run typecheck` exits 0

**Verification:** `npm run dev` → visit `http://localhost:3000/report` in a browser;
page renders without a runtime error and the browser tab shows "MySubscriptions".

---

### U4. Executive Summary section

**Goal:** The Summary section renders the full wireframe content from fixture data:
headline, integration-source status pills, time allocation breakdown, and
best/worst week highlights.

**Requirements:** R2

**Dependencies:** U3

**Files:**
- `app/report/components/SummarySection.tsx`

**Approach:** Server Component. Receives `report: Report` as a prop. Renders:

1. **Headline** — `"Your month decoded."` (fixed product framing; does not vary by month)
2. **Narrative paragraph** — `report.executiveSummary` rendered as a prose block below
   the headline. The fixture pre-writes a representative paragraph; S8 replaces this
   with AI-generated narrative. This is the "tell me the answer in 30 seconds" moment
   from `context/ui-report-page.md`.
3. **Source status** — maps `report.connectedSources` to labelled pills using shadcn
   `<Badge>`: calendar → "Google Calendar", health → "WHOOP". Both appear for the
   fixture; the UI is ready for single-source without a code change.
4. **Time allocation** — lists `report.metrics.topCategories` as a visual breakdown
   (label + percent + simple bar using Tailwind width utilities). No Recharts here —
   the aggregate numbers are conveyed adequately by the percentage bars without
   interactivity, and keeping this as a Server Component avoids a `'use client'`
   boundary for what is essentially a static summary.
5. **Week highlights** — maps `report.weekHighlights` to highlight cards (label,
   date range, recovery %, summary blurb) using shadcn `<Card>`.

**Test scenarios:**
- Renders without error when `connectedSources` is `["calendar"]` only (no WHOOP
  fields → no WHOOP badge)
- Renders without error when `weekHighlights` is empty (no highlight cards shown)
- Each `topCategories` entry produces a visible row with the correct label and percent
- `npm run typecheck` exits 0

**Verification:** Browser renders section; fixture data appears correctly; no hydration
warnings in the console.

---

### U5. Analysis section + chart

**Goal:** The Analysis Dashboard renders: a 6-stat KPI grid, a Top Categories
breakdown (Tailwind bars), and an activity↔recovery delta horizontal bar chart.

**Requirements:** R3, R6

**Dependencies:** U3, U1 (Recharts installed)

**Files:**
- `app/report/components/AnalysisSection.tsx` — Server Component; renders KPI
  grid, Top Categories, and chart container
- `app/report/components/ActivityDeltaChart.tsx` — `'use client'`; Recharts
  `BarChart` (horizontal) of `metrics.activityRecoveryDeltas`

**Approach:**

_KPI grid:_ Six shadcn `<Card>` components in a 2-col (mobile) / 3-col (tablet+)
responsive grid, sourced from `metrics`: Total Events, Total Recovery Cycles, Avg
Recovery %, Avg Strain, High Recovery Days, Low Recovery Days. Each stat is
conditionally rendered only if its source field is non-null — the grid gracefully
degrades for single-source connections without a code change in S9.

_Top Categories:_ `metrics.topCategories` is displayed as Tailwind progress bars
(label + percentage + colored bar) — the same visual treatment the wireframe shows in
the Analysis section for the Calendar-only view. This is a Server Component rendering;
no Recharts needed here. The time allocation is already shown this way in Analysis;
adding a redundant Recharts bar chart for the same data would echo the display without
adding information.

_ActivityDeltaChart:_ A horizontal `BarChart` with one bar per
`activityRecoveryDeltas` entry. This is the "inspectable chart" in the Analysis
Dashboard — it shows information not visible anywhere else (the correlation between
activity type and recovery outcomes). Chart spec: X-axis = activity category name
(`activity` field); Y-axis = recovery delta in percentage points (`deltaPercent` field).
Bars above zero (positive delta) render in one Tailwind token color (recovery boost);
bars below zero render in a different token color (recovery drag), split at the zero
baseline. When `activityRecoveryDeltas` is empty, renders nothing (the parent
`AnalysisSection` conditional already guards on `undefined`). Receives
`data: ActivityRecoveryDelta[]` as a prop. Uses shadcn's `<ChartContainer>` wrapper
for consistent theming. `'use client'` confined to this component only.

Wrap the `BarChart` in a container with `role="img"` and `aria-label` (e.g.,
`"Activity to recovery delta — {report.window.label}"`) for screen readers. Recharts
renders a bare SVG without accessible text by default.

Both sections receive only serializable props (plain arrays or null), enabling the
Server/Client boundary split cleanly.

**Test scenarios:**
- `AnalysisSection` renders without error when `metrics.activityRecoveryDeltas` is
  undefined (chart is conditionally rendered; no chart = no crash)
- `AnalysisSection` renders without error when `metrics.topCategories` is undefined
  (Top Categories block is conditionally rendered)
- `ActivityDeltaChart` renders negative delta values with a visually distinct color
  (fixture must include at least one negative delta to exercise this path)
- `npm run typecheck` exits 0 with `'use client'` directive on `ActivityDeltaChart` only

**Verification:** Browser renders the KPI grid, Top Categories bars, and delta chart
with fixture data; `AnalysisSection.tsx` has no `'use client'` directive; no console
errors on page load.

---

### U6. AI Insights section

**Goal:** The Insights section renders a finding count + data days header, and each
`Finding` as a typed card with the correct layout for its type.

**Requirements:** R4

**Dependencies:** U3

**Files:**
- `app/report/components/InsightsSection.tsx` — Server Component; renders header
  and maps findings to cards
- `app/report/components/InsightCard.tsx` — Server Component; renders one Finding

**Approach:**

_InsightsSection:_ Receives `findings: Finding[]` and `coverageDays: number`. Renders:
- Header: `"{findings.length} findings. {coverageDays} days of data."` — matches the
  wireframe exactly ("3 findings. 26 days of data"). `coverageDays` (26) is distinct
  from `window.days` (30); using `window.days` here would produce the wrong number.
- Maps each finding to `<InsightCard finding={finding} key={finding.id} />`

_InsightCard:_ A single shadcn `<Card>` whose content varies by `finding.type`:

| Field | finding | surprise | experiment |
|---|---|---|---|
| Title | finding.title | finding.title | finding.title |
| Description | finding.description | finding.description | finding.description |
| Alt explanation | always shown (⚠ ALTERNATIVE) | always shown | always shown |
| Confidence badge | shown | shown | shown |
| Sample size | shown if `n` present | shown if `n` present | shown if `n` present |
| "What would change my mind" | shown if present | — | — |
| Experiment block | — | — | instruction + expectedSignal + killCondition |
| "Add to calendar" CTA | — | — | shown |

`alternativeExplanation` is always rendered — it is a product invariant (wireframe:
"⚠ ALTERNATIVE caveat always visible"). Confidence maps to a shadcn `<Badge>` with
variant: `"high"` → green, `"medium"` → yellow, `"low"` → gray (using Tailwind token
classes, not hardcoded colors, so the theme can change). The badge renders a visible
text label — `"High"`, `"Medium"`, or `"Low"` — alongside the color, satisfying WCAG
1.4.1 (Use of Color). When `Finding.n` is present, append ` · n={n}` to the label
(e.g., `"Consistent · n=26"` matching the wireframe).

**Test scenarios:**
- `InsightCard` with `type: "finding"` renders title, description, alternativeExplanation,
  and confidence badge; experiment block is absent
- `InsightCard` with `type: "experiment"` renders instruction, expectedSignal,
  killCondition, and "Add to calendar" CTA; "what would change my mind" is absent
- `InsightCard` with `type: "surprise"` renders alternativeExplanation; experiment
  block is absent; confidence badge is shown
- `InsightCard` with `n: 26` renders the sample size; card with no `n` does not
- `npm run typecheck` exits 0

The "Add to calendar" button on experiment cards renders as **disabled** in S2, with
a tooltip or `aria-label` reading "Available after Calendar is connected." S5 (Calendar
integration) activates the button with a deep-link to the user's calendar app.

**Verification:** Browser renders three cards from the fixture (one per type); all
confidence badges are visible with text labels; the experiment card shows a disabled
"Add to calendar" button.

---

## Scope boundaries

### In scope
- shadcn/ui initialization and Card + Badge + Chart component installation
- `recharts` and `lucide-react` installation
- `Report` TypeScript types and Zod schemas in `shared/`
- Hardcoded `Report` fixture (both-sources scenario)
- `/report` route with three rendered sections: Summary, Analysis, Insights
- One Recharts chart in the Analysis section (activity↔recovery delta horizontal bar chart); time allocation is rendered as Tailwind bars
- `app/layout.tsx` metadata title update
- Temporary `/` → `/report` redirect

### Out of scope
- Any server, API route, or data fetching (S3)
- Auth or session gating (S4)
- Connection-tier conditional rendering (single-source vs. two-source gating is S9)
- Mobile tab navigation between sections (polish, S10) — S2 uses simple scroll sections
- Per-day trend / scatter charts (S7, when real `daySummaries` data exists)
- Playwright e2e tests (no user flow until auth exists, S4)

### Deferred to follow-up work
- Per-day charts using `daySummaries` (S7 — `daySummaries` is present in the contract
  now so S7 can add charts without a type change)
- Connection-tier gating UI (S9 — `AnalysisMetrics` already splits Calendar-only /
  WHOOP-only / correlation fields so S9 just adds conditional render logic)
- Mobile tab nav sticky bar (S10 polish)

---

## Notes

- The fixture's `activityRecoveryDeltas` must include at least one negative-delta entry
  and `topCategories` must have 3+ entries to exercise the rendering paths in U5.
- The fixture must set `coverageDays: 26` and populate exactly 26 `daySummary` entries.
  The 30-day `window.days` and 26-day `coverageDays` must never be conflated — they
  drive different UI text and are distinct contract fields.
- The `Finding.alternativeExplanation` being required (not optional) is an intentional
  product constraint — the brainstorm's skeptical self-critique technique demands a
  visible counter-explanation on every finding. Do not make it optional later without a
  deliberate product decision.
- S3 will lock the API seam against the Zod schemas authored in U2. Any post-S2 changes
  to `shared/schemas/report.ts` must be treated as breaking changes and coordinated
  across all slices.
