# WHOOP spike — technical feasibility

Goal: prove we can OAuth into WHOOP and pull historical **cycles / sleep / recovery**
for one user, as raw JSON. Steps: Authenticate → Fetch cycles → Fetch sleep →
Fetch recovery → Print JSON.

## What's here

- `whoop-spike.ts` — one-shot OAuth 2.0 (authorization-code) flow + paginated pull.
- `findings.md` — **portable, undocumented gotchas** (copy this into the web-app repo;
  it captures what's NOT in WHOOP's docs).
- `.env.example` — copy to `.env`, fill from the WHOOP Developer Dashboard.
- Output: `out/whoop-<timestamp>.json` (raw records) and `out/last.tokens.json`.

## Endpoints used (WHOOP API v2)

| Thing | URL |
|---|---|
| Authorize | `https://api.prod.whoop.com/oauth/oauth2/auth` |
| Token | `https://api.prod.whoop.com/oauth/oauth2/token` |
| Cycles | `GET https://api.prod.whoop.com/developer/v2/cycle` |
| Sleep | `GET https://api.prod.whoop.com/developer/v2/activity/sleep` |
| Recovery | `GET https://api.prod.whoop.com/developer/v2/recovery` |

Scopes requested: `offline read:profile read:cycles read:sleep read:recovery`.
Collections paginate via `nextToken` (query) → `next_token` (response), `limit` max 25,
filtered by `start`/`end` ISO date-times, sorted by start time descending.

## Run it

1. In the WHOOP Developer Dashboard, ensure the app has redirect URL
   `http://localhost:3000/callback` (add it — multiple are allowed).
2. `cp .env.example .env` and paste in `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET`.
3. `npm install`
4. `npm run spike`
5. Open the printed URL, approve, get redirected back. JSON lands in `out/`.

To test deeper history, set `LOOKBACK_DAYS=60` or `90` in `.env` and re-run.

## Feasibility findings — VERIFIED 2026-06-19 (real account, user_id *********)

**Verdict: feasible.** Full OAuth + 30d pull worked end-to-end on first run.

- [x] OAuth flow completes; **`http://localhost` redirect IS accepted** by WHOOP.
- [x] `offline` scope returns a **refresh_token** (access_token `expires_in=3600s`).
- [x] All requested scopes granted: `offline read:profile read:cycles read:sleep read:recovery`.
- [x] 30-day pull — **cycles 31 / sleep 30 / recovery 29** (counts differ; see below).
- [x] Historical access is **not a limit** — cycle endpoint returns full pages at
      90d / 180d / **365d** back, all with `next_token`. Reach ≥ 1 year.
- [x] Pagination via `next_token` works; **limit caps at 25/page** (≈15 pages/yr).
- [x] No 429s on this volume.

### Data model — joins are clean, calendar mapping is NOT 1:1
- **`cycle_id` is the central join key.** Every `recovery` has `cycle_id` + `sleep_id`;
  every `sleep` has `cycle_id`. 0 dangling references across all three collections.
- Recovery score lives on the **recovery** record (`score.recovery_score`, `hrv_rmssd_milli`,
  `resting_heart_rate`, `spo2_percentage`, `skin_temp_celsius`).
- **A WHOOP "cycle" ≠ a calendar day.** 31 cycles mapped to only **26 unique local days**
  (5 days had 2 cycles). Cycles are physiological (sleep-to-sleep), bounded by
  `start`/`end` + `timezone_offset`; the current ongoing cycle has `end: null`.
  → The aggregation layer needs an explicit, deterministic cycle→date rule
    (recommend: assign each cycle to the local date of its `start`, then aggregate;
    decide how to fold the rare double-cycle days).
- **Naps are mixed into the sleep collection** (`nap: true`). 1 of 30 here. Filter
  `nap === false` for "main sleep" metrics.
- Use `score_state === "SCORED"` to skip unscored/pending records.

## Open risks to resolve before building the web app
- **Cycle→calendar-date rule** (above) — the main modeling decision for correlations.
- **Token refresh choreography** — access token lives 1h; new tokens invalidate old,
  so a single refresh path (not concurrent) is needed server-side.
- **Prod redirect** — localhost is fine for dev; prod will need an https redirect URL
  registered on the WHOOP app.
- Counts drift (31/30/29): ongoing unscored cycle + occasional missing recovery/sleep —
  join on `cycle_id` and tolerate gaps rather than assuming equal lengths.
