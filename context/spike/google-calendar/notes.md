# Google Calendar spike — technical feasibility

Goal: prove we can OAuth into Google and pull the last 30 days of a single user's
**calendar events** as raw JSON. Steps: Authenticate → Fetch last 30 days → Print events.

> ✅ **Status: VERIFIED 2026-06-19.** Ran end-to-end against a real account — OAuth +
> 30-day pull of the primary calendar returned events on the first run. See
> `findings.md` for what's confirmed vs. still open (recurring expansion and all-day
> handling weren't exercised — no such events in the window).

## What's here

- `google-calendar-spike.ts` — one-shot OAuth 2.0 (authorization-code + PKCE) flow
  + paginated events pull, mirroring the WHOOP spike's shape.
- `findings.md` — gotchas (mostly **unverified**) + the run checklist to verify them.
- `.env.example` — copy to `.env`, fill from the Google Cloud Console.
- Output: `out/gcal-<timestamp>.json` (raw events) and `out/last.tokens.json`.

## Endpoints used (Calendar API v3)

| Thing | URL |
|---|---|
| Authorize | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token | `https://oauth2.googleapis.com/token` |
| Events list | `GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events` |

- Scope requested: `https://www.googleapis.com/auth/calendar.events.readonly`
  (narrowest read scope; `calendar.readonly` would also expose calendar metadata/ACLs).
- `calendarId=primary` = the signed-in user's main calendar.
- Events paginate via `nextPageToken` (response) → `pageToken` (query); `maxResults`
  caps at **2500**, so a 30-day window is almost always a single page.
- Query: `timeMin`/`timeMax` (RFC3339), `singleEvents=true` + `orderBy=startTime`.

## Run it

1. In Google Cloud Console → **APIs & Services**:
   - Enable the **Google Calendar API**.
   - **OAuth consent screen**: User type External; add yourself as a **Test user**.
   - **Credentials** → Create **OAuth client ID** → type **Web application**.
   - Add Authorized redirect URI: **`http://localhost:3000/callback`** (exact match).
2. `cp .env.example .env` and paste in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. `npm install`
4. `npm run spike`
5. Open the printed URL, approve, get redirected back. JSON lands in `out/`.

To test deeper history, set `LOOKBACK_DAYS=60` or `90` in `.env` and re-run.
To read a non-primary calendar, set `CALENDAR_ID=<id>`.
