# WHOOP — undocumented findings for development

Portable notes for the future web-app project. Everything here was **verified
empirically** against a real account (user_id *********) via the spike on
2026-06-19, and is **either missing from, or contradicts, WHOOP's official docs.**
For the things that ARE documented (endpoints, scopes, pagination shape), see
`notes.md`.

---

## 1. Token exchange is form-urlencoded, NOT JSON
The OAuth docs page describes the token request body as JSON. That's wrong (or at
least, the OAuth2 spec default works and JSON does not reliably). The exchange that
worked:

```
POST https://api.prod.whoop.com/oauth/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=…&client_id=…&client_secret=…&redirect_uri=…
```

Same for the refresh grant. Build the body with `URLSearchParams`, not `JSON.stringify`.

## 2. `http://localhost` redirect URIs ARE accepted
The docs imply only `https://` or custom schemes (e.g. `whoop://`). In practice a
plain `http://localhost:3000/callback` redirect registered on the app works fine for
the full auth-code flow. Good for local dev. **Prod will still need an https redirect**
registered on the app.

## 3. A WHOOP "cycle" is NOT a calendar day — this is the big one
Cycles are physiological (sleep-to-sleep), not midnight-to-midnight. Consequences the
docs don't spell out:
- In a 30-day window, **31 cycles mapped to only 26 unique local days** — some calendar
  days contain **two** cycles (e.g. a long nap or fragmented sleep splits the day).
- The current, in-progress cycle has **`end: null`**.
- Each cycle carries a `timezone_offset` (e.g. `"+10:00"`); you must apply it to `start`
  to get the user's *local* date. Don't slice the raw UTC timestamp.

**Implication for the aggregate layer:** you need an explicit, deterministic
cycle→local-date rule before correlating with calendar data. Suggested rule: bucket
each cycle by the local date of its `start`; for the rare double-cycle days, either
keep the primary (longest) cycle or sum — but decide it on purpose.

## 4. The three collections do NOT return equal counts
30-day sample returned **31 cycles / 30 sleep / 29 recovery**. Causes:
- The ongoing cycle isn't scored yet / has no recovery.
- Occasional missing recovery or sleep.

Don't zip the arrays by index. **Join on `cycle_id`** and tolerate gaps.

## 5. The join graph (verified: 0 dangling references)
```
cycle (id, start, end, timezone_offset, score.strain)
  ↑ cycle_id
sleep (id, cycle_id, nap, score.stage_summary, score.sleep_needed, respiratory_rate)
  ↑ cycle_id + sleep_id
recovery (cycle_id, sleep_id, score.recovery_score, hrv_rmssd_milli,
          resting_heart_rate, spo2_percentage, skin_temp_celsius)
```
- **`cycle_id` is the spine.** Recovery references both the cycle and the sleep.
- The **recovery score** (the headline % WHOOP shows you) lives on the *recovery*
  record as `score.recovery_score`, paired with HRV (`hrv_rmssd_milli`) and RHR.
- **Sleep stages** are millisecond totals under `score.stage_summary`
  (`total_light_sleep_time_milli`, `…_slow_wave_…`, `…_rem_…`, etc.) — compute
  hours yourself; there's no pre-summed "hours asleep" field.

## 6. Naps live in the sleep collection
Sleep records have a boolean `nap`. Naps are interleaved with main sleeps in the same
`/v2/activity/sleep` feed. **Filter `nap === false`** for "last night's sleep" metrics,
or you'll double-count.

## 7. Always gate on `score_state === "SCORED"`
Records can be `PENDING_SCORE` / `UNSCORABLE`. The `score` object is only trustworthy
when `score_state === "SCORED"`. Filter before aggregating.

## 8. Historical reach is effectively unlimited for our purposes
No documented hard limit, and in practice cycles paginate cleanly back **≥ 365 days**.
The real cost is pagination: **`limit` maxes at 25/page**, so a year ≈ 15 pages per
collection. Budget for ~45 sequential paged requests to backfill a year of all three.

## 9. Token lifecycle gotcha
- Access token `expires_in = 3600` (1 hour).
- Refreshing **invalidates the previous refresh token** (rotation). So you need a
  single serialized refresh path server-side — concurrent refreshes will clobber each
  other and log the user out. Store the latest refresh token atomically.

---

### Quick reference: fields we'll actually use
| Metric | Where |
|---|---|
| Recovery % | `recovery.score.recovery_score` |
| HRV | `recovery.score.hrv_rmssd_milli` |
| Resting HR | `recovery.score.resting_heart_rate` |
| Day strain | `cycle.score.strain` |
| Sleep duration | sum of `sleep.score.stage_summary.total_*_sleep_time_milli` |
| Sleep need | `sleep.score.sleep_needed.*` (baseline + debt + strain) |
| Local date | apply `timezone_offset` to `cycle.start` |
