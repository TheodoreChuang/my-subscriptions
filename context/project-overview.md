# MySubscriptions — Personal Insight Engine

## Overview

MySubscriptions connects a user's online services, normalizes their activity into a
common timeline, and uses AI to surface insights that emerge **only when multiple
sources are combined** — relationships no single-service dashboard can show. The MVP
proves this with **Google Calendar** (how time is spent) and **WHOOP** (how the body
responds), answering: *how does the way I schedule my life affect my recovery?*

## Goals

1. Connect two real services via OAuth and fuse their data into one daily timeline.
2. Compute relationships deterministically (the AI never calculates numbers).
3. Use AI to interpret those relationships honestly under small-sample uncertainty —
   the heart of the exercise.

## Core User Flow

1. Sign in; connect Google Calendar and/or WHOOP (OAuth). One service is enough to
   start — the app encourages the second rather than forcing it.
2. Choose which calendars to include. Only **owned** calendars are offered (the
   ones that reflect how the user actually spends time); the primary calendar is
   pre-selected, and the user can add their other owned calendars. Subscribed and
   shared calendars (holidays, birthdays, sports fixtures) are excluded as noise.
3. Generate analysis: retrieve → normalize signals → compute metrics & correlations
   → AI interpretation.
4. View the report — Executive Summary, Analysis Dashboard, AI Insights.

**Connection tiers (encourage, don't force):** one service yields an honest
single-source view (time allocation, or recovery trends) plus a prompt to connect
the second; two services unlock the cross-service correlations and AI insights that
are the actual product. The relationship framing ("how your schedule affects
recovery") is shown only when both sources are present — with one source the data
exists but the correlation cannot be computed, so the UI must not imply it.

## Features

### Service connection

- OAuth to Google Calendar and WHOOP. Calendar selection is scoped to owned
  calendars with the primary pre-selected — a smart default the user can adjust,
  not an all-or-nothing import — so the behavioral signal stays clean. Providers
  are treated as plug-ins behind durable categories (Calendar, Health), not
  hardcoded vendors.

### Deterministic analysis layer

- Normalizes events and health cycles into daily summaries; computes activity
  allocation, schedule-fragmentation metrics, and activity↔recovery correlations
  with sample size and uncertainty. AI receives these metrics, never raw events.

### AI Insights

- Interprets the deterministic layer with five techniques: competing hypotheses per
  finding, a generate-then-self-critique pass, recommendations framed as falsifiable
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

1. A user connects both services and gets a generated report from their real data.
2. Every surfaced number traces to the deterministic layer; the AI adds only
   interpretation, with sample size and confidence visible.
3. The AI demonstrably declines to over-interpret weak signals rather than
   manufacturing insights.