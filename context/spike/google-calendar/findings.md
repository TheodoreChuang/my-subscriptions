# Google Calendar — findings for development

Portable notes for the future web-app project, focused on what's **not obvious** or
easy to get wrong.

> ✅ **Spike ran end-to-end on 2026-06-19** against a real account (primary calendar,
> 30-day window, X events). Items are tagged: **[VERIFIED]** = confirmed by this run,
> **[DOC]** = official Google docs, **[COMMUNITY]** = widely reported behaviour,
> **[VERIFY]** = not exercised by this run (no such data in the window) — still open.
> See the checklist at the bottom for exactly what was/wasn't exercised.

---

## 1. The big one: 7-day refresh-token expiry while the app is in "Testing" [VERIFIED]
This is the Google equivalent of WHOOP's "cycle ≠ calendar day" — the gotcha that
shapes the product, not just the spike.

- **Verified directly:** the token response included `refresh_token_expires_in: 604799`
  — **exactly 7.00 days.** (Google doesn't normally surface a refresh-token TTL; getting
  a finite one here is the tell that the app is in Testing.) No need to wait a week.
- While the OAuth consent screen's **publishing status = "Testing"**, refresh tokens
  granted to test users are **revoked after 7 days**. The user gets silently logged
  out and the next refresh fails with `invalid_grant`.
- There's a documented exception — apps requesting only **name / email / profile**
  scopes don't expire after 7 days. **Calendar scopes are NOT in that subset**, so
  our web app *will* hit the 7-day wall until the app is **verified / "In production."**
- **Implication for the web app:** plan for Google's app-verification process before
  any real (non-test) users. In dev, just re-consent weekly, or flip the app to
  "In production" (unverified apps can still go to production with a warning screen,
  but sensitive-scope verification is required to drop the warning + the 7-day limit).

## 2. Calendar scopes are "sensitive" → verification gate [DOC]
`calendar.events.readonly` is a **sensitive** scope. Consequences:
- Dev with a handful of **test users** is friction-free (just add them on the consent
  screen).
- Production with external users requires **Google's OAuth app verification** (privacy
  policy, app domain, possibly a security review). Budget time for this. It is the
  main non-engineering risk to shipping.

## 3. You must ask for `access_type=offline` + `prompt=consent` to get a refresh token [VERIFIED]
Unlike some providers, Google does **not** return a `refresh_token` by default on the
auth-code flow, and on *repeat* authorizations it returns one only if you force consent.
The spike sends both params and **got a `refresh_token` back** (access token `expires_in=3599`).
Server-side web app must do the same on first link.

## 4. `orderBy=startTime` REQUIRES `singleEvents=true` [DOC/COMMUNITY]
Otherwise Google errors ("Single Events must be true to order by startTime").
`singleEvents=true` also **expands recurring events into individual instances** — which
is what you almost always want for a timeline/correlation view. Expanded instances carry
a `recurringEventId` pointing back to the series master.

## 5. Event time shape is polymorphic: all-day vs timed [DOC]
- **Timed events:** `start.dateTime` / `end.dateTime` (RFC3339 with offset) + `start.timeZone`.
- **All-day events:** `start.date` / `end.date` (`YYYY-MM-DD`, no time). `end.date` is
  **exclusive** (a 1-day event ends the next day).
- Don't assume `dateTime` exists. The spike's `eventStart()` falls back to `.date`.
  The aggregation layer needs an explicit all-day handling rule (analogous to WHOOP's
  cycle→local-date decision).

## 6. `timeMin`/`timeMax` filter semantics are asymmetric [DOC]
- `timeMin` = lower bound (exclusive) on an event's **end** time.
- `timeMax` = upper bound (exclusive) on an event's **start** time.
- Net effect: you get events that **overlap** the window, including ones that started
  before `timeMin` but are still ongoing. Good for "what was on my calendar," but means
  edge events can spill outside the nominal window — don't assume every result is fully
  inside [timeMin, timeMax].

## 7. Cancelled events can appear [DOC]
With `showDeleted` (default false) you mostly avoid these, but cancelled *instances* of
a recurring series can still surface (`status: "cancelled"`). Filter `status !== "cancelled"`
before treating something as a real event. The spike counts them so we can see how many.

## 8. Pagination + incremental sync [DOC]
- Page via `nextPageToken`. `maxResults` caps at **2500**; 30 days is one page for most
  people, so pagination is unlikely to bite in the spike but the loop is there.
- The final page returns a **`nextSyncToken`** instead of `nextPageToken`. For the web
  app, store it and pass `syncToken` later to fetch only **deltas** — far cheaper than
  re-pulling windows. (Sync tokens expire → handle `410 Gone` by doing a full resync.)

## 9. Web app reads more than one calendar [DOC]
`primary` is just the user's main calendar. Real users have several (work, shared,
subscribed, holidays). The web app should call **`calendarList.list`** to enumerate
calendars, then fetch events per calendar id. The spike only does `primary` to keep the
feasibility question small.

---

## Quick reference: fields we'll actually use
| Thing | Where |
|---|---|
| Title | `event.summary` |
| Start (timed) | `event.start.dateTime` (+ `event.start.timeZone`) |
| Start (all-day) | `event.start.date` (no time; `end.date` exclusive) |
| Real vs cancelled | `event.status` (`"confirmed"` / `"cancelled"`) |
| Recurring instance → series | `event.recurringEventId` |
| Attendees / busy | `event.attendees[]`, `event.transparency` |
| Delta sync handle | `nextSyncToken` (last page) |

---

## Run checklist — status after the 2026-06-19 run
- [x] OAuth flow completes; `http://localhost:3000/callback` redirect accepted.
- [x] `access_type=offline` + `prompt=consent` returns a **refresh_token**
      (access token `expires_in=3599`).
- [x] Scope granted == `calendar.readonly` (registered that scope, not `events.readonly`).
- [x] 30-day pull returns events: **X events, 0 all-day, 0 cancelled, 0 recurring instances.**
- [x] **7-day testing expiry confirmed** via `refresh_token_expires_in: 604799` (item #1).
- [ ] `singleEvents=true` expands recurring series into instances — **NOT exercised**:
      this account had no recurring events in the 30-day window. Param was accepted without
      error. Re-test on a window/calendar that contains a known weekly event.
- [ ] **All-day handling NOT exercised** (0 all-day events in window). `eventStart()` fallback
      to `start.date` is untested against real data — confirm on a window with an all-day event.
- [ ] Try `LOOKBACK_DAYS=365` — confirm historical reach + pagination (`nextPageToken`).

## Bonus finding [VERIFIED]
The token response carries a **`refresh_token_expires_in`** field (= 604799s here). Useful
server-side: a finite value is a reliable signal the app is still in Testing / unverified.
Once the app is verified + In Production this field should be absent (refresh tokens then
live until revoked). Worth asserting on in the web app to catch a mis-configured consent screen.
