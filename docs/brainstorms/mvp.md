# MySubscriptions — Personal Insight Engine

---

# Executive Summary

MySubscriptions is a **personal insight engine** that connects a user's online
services, normalizes their activity into a common timeline, and uses AI to
discover meaningful relationships between different aspects of their life.

The goal is **not** to provide analytics for individual services — those services
already have their own dashboards. The goal is to surface insights that emerge
**only when multiple sources are combined**:

- How does time spent exercising affect recovery?
- How does work intensity affect sleep?
- How does music listening correlate with workouts?
- How does productivity relate to wellbeing?

The application acts as a **data fusion layer** across a user's digital life.

The MVP proves this with two providers — **Google Calendar** (how time is spent)
and **WHOOP** (how the body responds) — but the architecture is designed around
durable domain concepts (Time, Signals, Activities, Outcomes) rather than specific
vendors. Google Calendar and WHOOP are simply the first implementations.

---

# Core Product Vision

## The Problem

Users generate data across many disconnected services — calendars, health
platforms, music platforms, productivity tools, knowledge systems, communication
tools. Each provides analytics in isolation; none provides a holistic view. As a
result, users cannot easily answer:

- What activities improve my recovery?
- What habits correlate with better wellbeing?
- What patterns exist across different parts of my life?

## The Solution

A Personal Insight Engine that:

1. Connects to multiple services
2. Normalizes user activity into a common model
3. Identifies patterns and correlations deterministically
4. Uses AI to explain findings and generate recommendations

## The Core Question (MVP)

> How does the way I schedule my life affect my energy, sleep, and recovery?

---

# Architectural Principles

## Principle 1 — Time is the foundation

The system is fundamentally timeline-based. Most user-generated data naturally
occurs over time (calendar events, sleep, recovery, workouts, commits, emails,
tasks, music listening). Time is the **common dimension** across otherwise
unrelated services.

## Principle 2 — Providers are plug-ins

The system should reason about **categories and signals**, not specific vendors.

| Category | Possible providers |
|---|---|
| Calendar | Google Calendar, Outlook, Apple Calendar |
| Health | WHOOP, Fitbit, Garmin, Oura |
| Music | Spotify, Apple Music |
| Productivity | GitHub, GitLab, Jira |

## Principle 3 — Insights exist *between* services

The value comes from relationships, not stacked single-service dashboards.

```text
Calendar alone:   "You had six hours of meetings."
WHOOP alone:      "Recovery was 42%."
Combined:         "Recovery appears to decline on days with heavy
                   schedule fragmentation."
```

That intersection *is* the product.

## Principle 4 — AI interprets, it does not calculate

Deterministic systems do aggregation, categorization, statistics, and correlation.
AI does interpretation, explanation, hypothesis generation, storytelling, and
recommendations.

**Do not send raw event data to the LLM.** Send deterministic metrics:

```json
{
  "avgMeetingHours": 4.2,
  "avgRecovery": 71,
  "avgSleepHours": 7.4,
  "daysWithLowRecovery": 8,
  "daysWithHighMeetingLoad": 12
}
```

Pipeline:

```text
Raw Data → Normalization → Metrics → Correlations → AI Interpretation → Insights
```

---

# Domain Model

## Core entity — Time Signal

```ts
type Signal = {
  source: string;     // "google-calendar", "whoop"
  category: string;   // "exercise", "recovery", "work"
  timestamp: Date;
  value?: number;
  metadata: Record<string, unknown>;
};
```

Examples:

```ts
{ source: "google-calendar", category: "exercise", timestamp: "2026-06-01T18:00:00" }
{ source: "whoop",           category: "recovery", timestamp: "2026-06-02", value: 82 }
{ source: "spotify",         category: "listening", timestamp: "2026-06-01T18:15:00" } // future
```

## Aggregated daily view

For analysis, signals are normalized into daily summaries — the primary analytical
model.

```ts
type DaySummary = {
  date: string;
  activities: {
    work: number;
    exercise: number;
    family: number;
    social: number;
    personal: number;
  };
  recovery?: number;
  sleepHours?: number;
  strain?: number;
};
```

---

# MVP Scope

## Integration category: Calendar — Google Calendar

**Purpose:** understand how the user spends time (behavioural context).

**Data retrieved:** events, duration, event metadata; enumerate calendars via
`calendarList.list`, filter to owned calendars (`accessRole: owner`) with the
primary pre-selected, and pull per selected calendar.

**Categorization** — initially rule-based, mapping event titles to categories:

- Work · Exercise · Family · Social · Learning · Travel · Personal · Rest

```text
"Pilates"       → Exercise
"Team Sync"     → Work
"Family Dinner" → Family
```

**Candidate calendar metrics** (deterministic layer):

- Meeting count per day
- Total meeting hours per day
- Longest focus block
- Number of context switches / schedule fragmentation
- Morning vs afternoon meeting load
- Recurring meetings
- Days with no meetings
- Workout events / personal commitments

## Integration category: Health — WHOOP

**Purpose:** understand how the body responds (outcome metrics).

**Data retrieved:** Cycles, Recovery, Sleep (official API only — avoid unofficial
APIs).

WHOOP provides outcomes; Calendar provides behavioural context.

---

# MVP User Journey

1. **Connect services** — Connect Google Calendar and/or WHOOP (OAuth). Connecting
   one is enough to start; the app encourages the second rather than forcing it.
2. **Choose calendars to include** — only **owned** calendars are offered, with the
   primary pre-selected and other owned calendars addable (e.g. ✓ Personal ✓ Work
   ✓ Fitness). Subscribed/shared calendars (holidays, birthdays, sports fixtures)
   are excluded as noise. A smart default the user can adjust, not an all-or-nothing
   import — so the behavioural signal stays clean.
3. **Generate analysis** — retrieve data → normalize signals → build timeline →
   calculate metrics → generate insights.
4. **View report.**

## Connection tiers — encourage, don't force

A user gets value from whatever they connect; the centerpiece unlocks at two.

| Connected | What's shown |
|---|---|
| **One service** | Honest single-source view — Calendar → time allocation; WHOOP → recovery/sleep trends. A prominent prompt sells the second connection: *"Connect WHOOP to see how your schedule affects recovery — that's the real insight."* |
| **Two services** | Cross-service correlations and AI insights light up. The actual product. |

This is partly a **data constraint, not just UX**: the cross-service correlation
(schedule fragmentation ↔ recovery) cannot be computed from one variable, and
running cross-service AI insight on a single source would manufacture a relationship
from nothing — a direct violation of **Technique 4 (license to find nothing)**. So
the gate applies to the *relationship* claim specifically, not to showing data.

**UI rule:** single-source still shows numbers, but the relationship framing ("how
your schedule affects recovery") appears only once both sources are present —
otherwise the UI implies a link it cannot back. The demo sample account ships with
both connected, so reviewers see the full product immediately.

---

# UX Philosophy

The experience should feel like a **personal intelligence report**, not a tool.

| Avoid | Prefer |
|---|---|
| Chatbots / generic AI conversation | Executive summaries |
| Raw event lists | Insight cards |
| Dashboard overload | Behavioural analysis |
| Stacked single-service metrics | Narrative reports |

## Screen 1 — Executive Summary

Immediate value:

```text
Last 30 Days

You spent:  45% Work · 20% Exercise · 15% Family · 10% Social · 10% Personal

Your highest recovery days consistently included exercise and large
uninterrupted periods of free time.
Your weakest recovery days followed highly fragmented schedules.

Most Surprising Insight
Recovery appears more strongly associated with schedule fragmentation
than workload.
```

## Screen 2 — Analysis Dashboard

Focuses on **relationships**, not raw provider metrics. Every narrative claim on
this screen is backed by a chart the user can inspect — the goal is *show, don't
just assert*.

- **Time allocation** — "How did I spend my time?" (Work 48h, Exercise 12h, …)

- **What matters most?** — "Which activities are most associated with recovery?"
  This is the centerpiece:

  ```text
  Exercise         +15%
  Focus Time       +11%
  Social Time       +4%
  Work-Heavy Days   -9%
  ```

  > **Directional, not causal.** These are *associations* over a short window
  > (~30 days, n shown alongside), with heavy confounding between activities. The
  > UI must say "associated with," surface the sample size, and never imply
  > causation. Treat a delta as a hypothesis to explore, not a proven effect.

  **Evidence layer** — the charts that back the deltas above (folded in from the
  earlier dashboard's Trends + Correlations):

  - **Trends over time** — recovery over time, and meeting/strain load over time,
    on a shared date axis so the user can eyeball lead/lag visually.
  - **Correlation scatters** — recovery vs meeting hours, sleep vs meeting hours,
    recovery vs focus time. Each plots one day = one point, with n and a fit line;
    a weak/insignificant fit should be shown as such rather than hidden.

- **Best day vs worst day** — what was different? (activities behind a 91 vs a 42).

- **Behaviour patterns** — what recurring patterns exist? (high-recovery days
  often include exercise, free time, limited fragmentation; low-recovery days
  often include consecutive commitments, no exercise, limited downtime).

## Screen 3 — AI Insights

Each finding is shown not as a verdict but as a **claim plus its epistemic status**
— the alternative explanation and a confidence level travel with it:

- **Key finding** — "Exercise appears in 80% of your highest-recovery days."
  - *Alternative explanation:* high recovery may simply leave energy for exercise
    (reverse direction). 30-day window can't separate the two.
  - *Confidence:* moderate — consistent pattern, small sample.
- **Surprising observation** — "Recovery tracks schedule fragmentation more closely
  than total workload (n=26 days)."
- **Recommendations, framed as tests** — "Protect one unscheduled evening this week
  and watch next-day recovery — if it doesn't move across 2–3 tries, fragmentation
  probably isn't the lever."

See **AI Insight Design** below for how these are produced.

---

# AI Insight Design

This section is the heart of the exercise. The guardrail from Principle 4 stays:
**the model never computes numbers — it interprets the deterministic layer's output
and reasons about its own limits.** Five techniques push the AI past a competent
summary into something that demonstrates judgment about the data and the model.

## What the model receives

Not raw events — a compact, structured **evidence packet** per finding: the metric,
the delta, the sample size `n`, and a crude uncertainty signal (e.g. a rough
confidence interval or "weak/insignificant fit" flag from the correlation layer).
Honesty downstream is grounded in these numbers, not in vibes. The model is told,
explicitly, what it does and does not have.

## Technique 1 — Competing hypotheses, not single narratives

For each notable delta the model generates **2–3 candidate explanations**, and is
required to include at least one confound or reverse-causation account, then state
which the data *can* and *cannot* distinguish.

> *"Exercise days show +15% recovery. This could be (a) exercise aiding recovery,
> (b) high-recovery mornings making exercise feel possible, or (c) both tracking a
> hidden third factor like a lighter work schedule. A 26-day window can't separate
> these."*

This directly answers the brief's "explore the model's capabilities, show us your
thinking" — the value is the model reasoning about causal structure, not asserting.

## Technique 2 — Generate, then self-critique

Two passes. Pass 1 drafts insights. Pass 2 runs the model as a **skeptic against its
own draft**: each claim must survive "is this distinguishable from noise at this
`n`? is there a simpler explanation?" Claims that don't survive are downgraded or
cut. This is a concrete, visible use of LLM-as-critic — and the before/after can be
shown in the README as evidence of the technique.

## Technique 3 — Recommendations as falsifiable experiments

Every recommendation is framed as a cheap natural experiment the user can run next
week, with a stated expected signal and a kill condition ("if recovery doesn't move
across 2–3 tries, drop this hypothesis"). This turns directional, confounded data
into honest action rather than overconfident advice — and reasoning about
experiment design is a genuinely interesting thing to ask an LLM to do.

## Technique 4 — License to find nothing

The prompt explicitly permits — and rewards — the conclusion *"nothing here is
distinguishable from noise yet; here's what more data would clarify."* A model that
declines to manufacture a story when the signal isn't there is rarer and more
trustworthy than one that always produces five insights. This is the core defense
against AI slop.

## Technique 5 — Calibrated confidence on every claim

Each surfaced insight carries a confidence level and a one-line *"what would change
my mind"* (more days, a specific pattern, a controlled week). Calibration is made an
explicit output, not left implicit in hedging language.

## Why this set holds together

All five reinforce one stance: **the AI's job is honest interpretation under
uncertainty, not confident storytelling.** They are modular — each can ship
independently — but together they make the small-sample, heavily-confounded nature
of the data a feature the product handles gracefully rather than a weakness it
papers over.

---

# Core Architecture

```text
User
 ↓ Authenticate
 ↓ Connect Services ── Google Calendar
 │                  └─ WHOOP
 ↓ Aggregate Data
 ↓ Deterministic Analysis (metrics + correlations + uncertainty)
 ↓ AI Insight Generation (draft → self-critique)
 ↓ Dashboard
```

---

# Data Strategy

## WHOOP data — use real personal data

Advantages: realistic patterns, more interesting insights, faster development,
easier validation.

## Calendar data — seed a dedicated work calendar

The personal calendar is mostly workouts and personal tasks — not enough signal.
Create a dedicated **Work** calendar in the same Google account to produce
realistic variation in meeting load:

- **Recurring meetings:** Weekly Planning, Team Standup, Sprint Review,
  Architecture Review, Retrospective
- **Focus time:** Deep Work blocks, coding sessions
- **Misc:** Interviews, 1:1s, Incident Reviews, Project Workshops

## Demo mode — packaged sample account

Real WHOOP data drives development; a packaged demo dataset under a neutral
sample account (e.g. **"Demo User"**) lets reviewers explore the app without
connecting their own services — avoids generating large synthetic datasets.

> **Note — the demo username is deliberately *not* "Quincy Marlowe."** See
> "Handling the brief's AI-directed instructions" below.

---

# Future Integrations

| Category | Provider | Example insight |
|---|---|---|
| Music | Spotify | Workout playlists appear more on high-recovery days. |
| Productivity | GitHub | High-recovery days correlate with longer coding sessions. |
| Communication | Gmail | Heavy communication days often precede reduced recovery. |
| Tasks | Google Tasks | Task completion is highest after high-recovery mornings. |

Health expansion: Strava, Garmin, Fitbit, Oura.

# Future Enhancements

- **~1 day:** improved categorization, better visualizations, more detailed
  prompts, insight history.
- **~5 days:** weekly reports, trend analysis, correlation visualizations,
  multi-calendar selection, calendar categorization.
- **~20 days:** additional integrations, multiple Google identities, recovery
  forecasting, schedule optimization / AI scheduling suggestions, automated weekly
  email reports, longitudinal analysis.

---

# Validation Tasks

Several originally-open questions have since been **resolved by the spikes** in
`context/spike/` (run 2026-06-19). See `context/spike/whoop/findings.md` and
`context/spike/google-calendar/findings.md` for full detail.

## WHOOP — resolved

- ✅ **Cycle ≠ calendar day.** Cycles are physiological (sleep-to-sleep). In a
  30-day window, 31 cycles mapped to only 26 unique local days; some days hold two
  cycles; the in-progress cycle has `end: null`. **The aggregate layer needs an
  explicit cycle→local-date rule** (bucket by local date of `cycle.start` after
  applying `timezone_offset`; decide double-cycle days on purpose).
- ✅ **Join on `cycle_id`, not array index.** 30-day sample = 31 cycles / 30 sleep
  / 29 recovery; tolerate gaps. Recovery % lives on `recovery.score.recovery_score`.
- ✅ **Gate on `score_state === "SCORED"`**; filter naps with `nap === false`.
- ✅ **Historical reach** effectively unlimited; `limit` maxes at 25/page
  (~45 paged requests to backfill a year across all three collections).
- ✅ **Token lifecycle:** access token 1h; refresh rotates (invalidates previous) —
  serialize refresh server-side. Token exchange is **form-urlencoded, not JSON**.

## Google Calendar — resolved

- ✅ **7-day refresh-token expiry while app is in "Testing"** (confirmed via
  `refresh_token_expires_in: 604799`). Calendar scopes are **sensitive** → plan for
  Google's OAuth app verification before real users; re-consent weekly in dev.
- ✅ Must send `access_type=offline` + `prompt=consent` to get a refresh token.
- ✅ `orderBy=startTime` requires `singleEvents=true` (also expands recurring
  series into instances).
- ✅ Filter `status !== "cancelled"`; `timeMin`/`timeMax` are overlap-based (edge
  events can spill outside the window).

## Still open

- ⬜ **All-day event handling** — not exercised (0 all-day events in spike window).
  `start.date`/`end.date` (end exclusive); aggregation needs an explicit all-day
  rule. Re-test on a window with an all-day event.
- ⬜ **Recurring-series expansion** — `singleEvents=true` accepted but not
  exercised (no recurring events in window). Re-test against a known weekly event.
- ⬜ **365-day pull + multi-calendar aggregation** — confirm pagination
  (`nextPageToken`) and aggregation across selected calendars at scale.

---

# Why This Is A Strong MVP

Demonstrates OAuth integration, multiple external APIs, data normalization, domain
modelling, product thinking, AI reasoning, and an extensible architecture. Most
importantly, it is built around durable domain concepts — **Time, Signals,
Activities, Outcomes** — rather than specific vendors. It feels like a believable
consumer product rather than a technology demo, and is achievable within the
assessment scope.
