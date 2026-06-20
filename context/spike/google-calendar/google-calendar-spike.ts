/**
 * Google Calendar feasibility spike
 * ---------------------------------
 * Goal (context/spike/google-calendar/notes.md):
 *   Authenticate -> Fetch last 30 days of events -> Print events
 *
 * Throwaway code to answer ONE question: can we OAuth into Google and reliably
 * pull a single user's recent calendar events for a planned web app? It runs a
 * one-shot local OAuth 2.0 authorization-code flow (with PKCE), then lists
 * events from the primary calendar over a lookback window and writes raw JSON
 * to ./out.
 *
 * Mirrors the WHOOP spike's shape on purpose so the two are easy to compare.
 *
 * Run:  cp .env.example .env  (fill in) ;  npm i ;  npm run spike
 *
 * Zero runtime deps: Node 18+ built-in fetch + node:http. tsx runs the TS.
 */

import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import { URL, URLSearchParams } from "node:url";

// --- Google OAuth + Calendar endpoints --------------------------------------
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/calendar/v3";

// Read-only scope registered on the consent screen. calendar.readonly is a
// superset of calendar.events.readonly (also reads calendar metadata/ACLs); for
// the eventual web app, narrow to calendar.events.readonly if we only need events.
// Either way it's a Google "sensitive" scope -> app verification required before
// production external users. See findings.md.
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

// --- tiny .env loader (avoid a dependency) ----------------------------------
async function loadEnv(): Promise<void> {
  if (!existsSync(".env")) return;
  const raw = await readFile(".env", "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k] === undefined) {
      process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var ${name}. See .env.example.`);
    process.exit(1);
  }
  return v;
}

// --- PKCE helpers -----------------------------------------------------------
// Google supports PKCE for the auth-code flow; harmless alongside a confidential
// (Web application) client and good practice. S256 = base64url(sha256(verifier)).
function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

// --- step 1: authorize in the browser, catch the code on localhost ----------
function authorize(
  clientId: string,
  redirectUri: string,
  challenge: string,
): Promise<{ code: string }> {
  const state = randomBytes(16).toString("hex");
  const port = Number(new URL(redirectUri).port || 80);
  const callbackPath = new URL(redirectUri).pathname;

  const authorizeUrl =
    `${AUTH_URL}?` +
    new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state,
      // access_type=offline + prompt=consent => reliably returns a refresh_token,
      // even on re-runs (Google otherwise returns it only on first consent).
      access_type: "offline",
      prompt: "consent",
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (reqUrl.pathname !== callbackPath) {
        res.writeHead(404).end("not found");
        return;
      }
      const err = reqUrl.searchParams.get("error");
      const code = reqUrl.searchParams.get("code");
      const returnedState = reqUrl.searchParams.get("state");

      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        `<html><body style="font-family:sans-serif"><h2>${
          err ? "Google auth failed" : "Google Calendar authorized ✓"
        }</h2><p>You can close this tab and return to the terminal.</p></body></html>`,
      );
      server.close();

      if (err) return reject(new Error(`Authorization error: ${err}`));
      if (returnedState !== state) {
        return reject(new Error("State mismatch — possible CSRF; aborting."));
      }
      if (!code) return reject(new Error("No authorization code in callback."));
      resolve({ code });
    });

    server.listen(port, () => {
      // Also write to a file: when run under `npm run`, stdout is block-buffered
      // to a redirected log and won't appear until exit.
      writeFileSync("authorize-url.txt", authorizeUrl + "\n");
      console.log("\n1) Open this URL in your browser to authorize Google Calendar:\n");
      console.log("   " + authorizeUrl + "\n");
      console.log(`   Waiting for redirect to ${redirectUri} ...`);
    });
    server.on("error", reject);
  });
}

// --- step 2: exchange code for tokens ---------------------------------------
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  verifier: string,
): Promise<TokenResponse> {
  // Google's token endpoint expects form-urlencoded.
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

// --- step 3: page through events over the lookback window -------------------
interface CalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurringEventId?: string;
  [k: string]: unknown;
}

interface EventsPage {
  items?: CalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

async function fetchEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      // singleEvents=true expands recurring events into instances; REQUIRED to
      // sort by startTime (otherwise Google errors).
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500", // hard cap; 30d easily fits one page
    });
    if (pageToken) params.set("pageToken", pageToken);

    const url = `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`GET events failed ${res.status}: ${await res.text()}`);
    }
    const page = (await res.json()) as EventsPage;
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
    pages++;
  } while (pageToken && pages < 100); // safety cap

  return events;
}

// All-day events use start.date; timed events use start.dateTime. Handle both.
function eventStart(e: CalendarEvent): string {
  return e.start?.dateTime ?? e.start?.date ?? "(no start)";
}

// --- main -------------------------------------------------------------------
async function main() {
  await loadEnv();
  const clientId = required("GOOGLE_CLIENT_ID");
  const clientSecret = required("GOOGLE_CLIENT_SECRET");
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/callback";
  const calendarId = process.env.CALENDAR_ID || "primary";
  const lookbackDays = Number(process.env.LOOKBACK_DAYS || "30");

  const end = new Date();
  const start = new Date(end.getTime() - lookbackDays * 86_400_000);
  const timeMin = start.toISOString();
  const timeMax = end.toISOString();

  const { verifier, challenge } = makePkce();

  const { code } = await authorize(clientId, redirectUri, challenge);
  console.log("\n2) Got authorization code, exchanging for tokens...");
  const tokens = await exchangeCode(
    code,
    clientId,
    clientSecret,
    redirectUri,
    verifier,
  );
  console.log(
    `   access_token acquired (expires_in=${tokens.expires_in}s, ` +
      `refresh_token=${tokens.refresh_token ? "yes" : "NO"}, scope="${tokens.scope}")`,
  );

  console.log(
    `\n3) Listing '${calendarId}' events for last ${lookbackDays}d: ${timeMin} -> ${timeMax}\n`,
  );
  const events = await fetchEvents(tokens.access_token, calendarId, timeMin, timeMax);

  const allDay = events.filter((e) => e.start?.date && !e.start?.dateTime).length;
  const cancelled = events.filter((e) => e.status === "cancelled").length;
  const recurringInstances = events.filter((e) => e.recurringEventId).length;

  console.log(`   events            ${events.length}`);
  console.log(`   ├─ all-day        ${allDay}`);
  console.log(`   ├─ cancelled      ${cancelled}`);
  console.log(`   └─ recurring inst ${recurringInstances}`);
  console.log("\n   first few:");
  for (const e of events.slice(0, 10)) {
    console.log(`     ${eventStart(e).padEnd(28)} ${e.summary ?? "(no title)"}`);
  }

  await mkdir("out", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = `out/gcal-${stamp}.json`;
  await writeFile(
    outFile,
    JSON.stringify(
      {
        window: { timeMin, timeMax, lookbackDays },
        calendarId,
        scope: tokens.scope,
        count: events.length,
        events,
      },
      null,
      2,
    ),
  );

  // also keep tokens so we can re-test refresh without re-authorizing
  await writeFile("out/last.tokens.json", JSON.stringify(tokens, null, 2));

  console.log(`\n4) Wrote raw JSON -> ${outFile}`);
}

main().catch((e) => {
  console.error("\nSpike failed:", e.message ?? e);
  process.exit(1);
});
