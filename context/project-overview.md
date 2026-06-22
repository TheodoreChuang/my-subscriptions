# MySubscriptions — Personal Insight Engine

## Overview

MySubscriptions connects a user's online services, normalizes their activity into a
common timeline, and uses AI to surface insights. The MVP proves this with **Google Calendar** 
(how time is spent) and **WHOOP** (how the body responds), answering: *how does the way I 
schedule my life affect my recovery?*

## Goals

1. Connect one or more real services via OAuth and fuse their data into one daily timeline.
2. Compute relationships deterministically (the AI never calculates numbers).
3. Use AI to interpret those relationships honestly under small-sample uncertainty —
   the heart of the exercise.

## Core User Flow

1. Sign in with Google (social login). This creates the account and is **identity
   only** — it authenticates the user; it does *not* connect any data source.
   Connecting Google Calendar for its data is a separate step (below), so a user can
   sign in and then connect only WHOOP, only Calendar, or both.
2. Connect Google Calendar and/or WHOOP (OAuth). One service is enough to start — the
   app encourages the second rather than forcing it.
3. Choose which calendars to include. Only **owned** calendars are offered (the
   ones that reflect how the user actually spends time); the primary calendar is
   pre-selected, and the user can add their other owned calendars. Subscribed and
   shared calendars (holidays, birthdays, sports fixtures) are excluded as noise.
4. The report generates **automatically** — there is no "generate" button. The
   pipeline (retrieve → normalize signals → compute metrics & correlations → AI
   interpretation) runs synchronously within the request — no job queue or cron; the
   user sees a loading state while it runs and the finished report when it lands.
5. View the report — Executive Summary, Analysis Dashboard, AI Insights — over a
   rolling last-30-days window (see **Report model**).

**Connection tiers (encourage, don't force):** one service yields an honest
single-source view (time allocation, or recovery trends) plus a prompt to connect
the second; two services unlock the cross-service correlations and AI insights that
are the actual product. The relationship framing ("how your schedule affects
recovery") is shown only when both sources are present — with one source the data
exists but the correlation cannot be computed, so the UI must not imply it.

## Report model

**Report window — rolling last 30 days.** Every report is computed over the most
recent 30 days. This window is deliberately short: it keeps the signal current, and
it is *why* sample sizes are small — which is exactly the uncertainty the AI layer
must reason honestly about rather than paper over.

**A "day" is a calendar day — midnight to midnight UTC**. This is the canonical spine
the timeline is keyed on: WHOOP cycles (which are physiological, not midnight-aligned)
map onto the calendar day they mostly fall in, and calendar events join by their
date. So "n = 26 days" on a report means 26 calendar days, uniformly across sources.

**Generation is automatic, never manual.** The user never presses "generate." The
report's existence is a function of the connected integration(s) and the clock:

```txt
No report exists        →  Generate automatically (show loading UI)
Window has drifted      →  Regenerate automatically
Integration changes     →  Regenerate automatically
Report exists           →  Display immediately
```

- **No report exists** → generate from scratch; the user sees a loading state until
  the first report lands.
- **Window has drifted** → because the window is *rolling*, a report generated days
  ago no longer covers a true last-30-days. When the app detects the window has moved
  on (e.g. first open on a new day), it regenerates so the report stays honest to its
  own label.
- **Integration changes** → regenerate. An integration change is any change to the
  inputs: connecting service, *and* changing which calendars are
  included. Both alter the underlying data, so both invalidate the current report.
- **Report exists and is current** → display it immediately on open. When a
  regeneration is triggered (below), the loading state shows until the refreshed
  report is ready.

A loading state is shown during report generation or regeneration.

**One current report, overwritten in place.** There is exactly one report per user at
a time; regeneration replaces it. Report history is a future enhancement (see Scope),
so nothing here versions or retains past reports.

## Features

### Service connection

- OAuth to Google Calendar and WHOOP. Calendar selection is scoped to owned
  calendars with the primary pre-selected — a smart default the user can adjust,
  not an all-or-nothing import — so the behavioral signal stays clean. Providers
  are treated as plug-ins behind durable categories (Calendar, Health), not
  hardcoded vendors.

### Deterministic analysis layer

- Over the rolling last-30-days window, normalizes events and health cycles into
  daily summaries; computes activity allocation, schedule-fragmentation metrics, and
  activity↔recovery correlations with sample size and uncertainty. The short window
  keeps samples small by design, so reporting that uncertainty is mandatory. AI
  receives these metrics, never raw events.

### AI Insights

- Interprets the deterministic layer with five techniques: competing hypotheses per
  finding, a skeptical self-critique that downgrades or cuts claims indistinguishable
  from noise, recommendations framed as falsifiable
  experiments, explicit license to "find nothing," and calibrated confidence. Stance:
  honest interpretation under uncertainty, not confident storytelling.

### Insight report UI

- A personal intelligence report (not a chatbot): executive summary, a relationships
  dashboard where every claim is backed by an inspectable chart, and AI insight cards
  that carry their alternative explanation and confidence.

## Scope

### In Scope

- Google Calendar + WHOOP OAuth and data retrieval.
- Deterministic daily aggregation, metrics, and correlations.
- AI insight generation with the techniques above.
- The three report screens.

### Out Of Scope

- Additional providers (Spotify, GitHub, Gmail, other health platforms).
- Claims of causation — findings are directional and labeled as such.
- Accounts beyond a single connected user; multi-identity support.

#### Future Enhancements

- ~1 day: better categorization, richer visualizations, insight history.
- ~5 days: weekly reports, trend/correlation views, multi-calendar categorization.
- ~20 days: more integrations, recovery forecasting, AI scheduling suggestions,
  automated weekly email reports.

## Success Criteria

1. A user connects one or more service(s) and a report over their real last-30-days data is
   generated automatically — no manual "generate" step — and regenerates when an
   integration or the window changes.
2. Every surfaced number traces to the deterministic layer; the AI adds only
   interpretation, with sample size and confidence visible.
3. The AI demonstrably declines to over-interpret weak signals rather than
   manufacturing insights.