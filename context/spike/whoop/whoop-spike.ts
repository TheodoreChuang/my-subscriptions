/**
 * WHOOP feasibility spike
 * -----------------------
 * Goal (context/spike/whoop/notes.md):
 *   Authenticate -> Fetch cycles -> Fetch sleep -> Fetch recovery -> Print JSON
 *
 * This is throwaway code to answer ONE question: can we OAuth into WHOOP and
 * reliably pull historical cycles/sleep/recovery for a single user? It runs a
 * one-shot local OAuth 2.0 authorization-code flow, then paginates each
 * collection over a lookback window and writes the raw JSON to ./out.
 *
 * Run:  cp .env.example .env  (fill in) ;  npm i ;  npm run spike
 *
 * Zero runtime deps: Node 18+ built-in fetch + node:http. tsx runs the TS.
 */

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync, writeFileSync } from "node:fs";
import { URL, URLSearchParams } from "node:url";

// --- WHOOP endpoints (v2) ---------------------------------------------------
const AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const API_BASE = "https://api.prod.whoop.com/developer";

const COLLECTIONS = {
  cycle: "/v2/cycle",
  sleep: "/v2/activity/sleep",
  recovery: "/v2/recovery",
} as const;

// Scopes we need for the planned product. `offline` => refresh token.
const SCOPES = [
  "offline",
  "read:profile",
  "read:cycles",
  "read:sleep",
  "read:recovery",
];

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

// --- step 1: authorize in the browser, catch the code on localhost ----------
function authorize(
  clientId: string,
  redirectUri: string,
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
          err ? "WHOOP auth failed" : "WHOOP authorized ✓"
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
      console.log("\n1) Open this URL in your browser to authorize WHOOP:\n");
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
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<TokenResponse> {
  // OAuth 2.0 token endpoint expects form-urlencoded.
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
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

// --- step 3: paginate a collection over the lookback window -----------------
interface Page {
  records: unknown[];
  next_token?: string | null;
}

async function fetchAll(
  path: string,
  accessToken: string,
  startISO: string,
  endISO: string,
): Promise<unknown[]> {
  const records: unknown[] = [];
  let nextToken: string | undefined;
  let pages = 0;

  do {
    const params = new URLSearchParams({
      start: startISO,
      end: endISO,
      limit: "25", // WHOOP v2 max per page
    });
    if (nextToken) params.set("nextToken", nextToken);

    const res = await fetch(`${API_BASE}${path}?${params}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`GET ${path} failed ${res.status}: ${await res.text()}`);
    }
    const page = (await res.json()) as Page;
    records.push(...(page.records ?? []));
    nextToken = page.next_token ?? undefined;
    pages++;
  } while (nextToken && pages < 100); // safety cap

  return records;
}

// --- main -------------------------------------------------------------------
async function main() {
  await loadEnv();
  const clientId = required("WHOOP_CLIENT_ID");
  const clientSecret = required("WHOOP_CLIENT_SECRET");
  const redirectUri =
    process.env.WHOOP_REDIRECT_URI || "http://localhost:3000/callback";
  const lookbackDays = Number(process.env.LOOKBACK_DAYS || "30");

  const end = new Date();
  const start = new Date(end.getTime() - lookbackDays * 86_400_000);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const { code } = await authorize(clientId, redirectUri);
  console.log("\n2) Got authorization code, exchanging for tokens...");
  const tokens = await exchangeCode(code, clientId, clientSecret, redirectUri);
  console.log(
    `   access_token acquired (expires_in=${tokens.expires_in}s, ` +
      `refresh_token=${tokens.refresh_token ? "yes" : "NO"}, scope="${tokens.scope}")`,
  );

  console.log(
    `\n3) Fetching ${lookbackDays}d window: ${startISO} -> ${endISO}\n`,
  );
  const result: Record<string, { count: number; records: unknown[] }> = {};
  for (const [name, path] of Object.entries(COLLECTIONS)) {
    const records = await fetchAll(path, tokens.access_token, startISO, endISO);
    result[name] = { count: records.length, records };
    console.log(`   ${name.padEnd(9)} ${records.length} records`);
  }

  await mkdir("out", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = `out/whoop-${stamp}.json`;
  await writeFile(
    outFile,
    JSON.stringify(
      { window: { startISO, endISO, lookbackDays }, scope: tokens.scope, ...result },
      null,
      2,
    ),
  );

  // also keep tokens so we can re-test refresh without re-authorizing
  await writeFile(
    "out/last.tokens.json",
    JSON.stringify(tokens, null, 2),
  );

  console.log(`\n4) Wrote raw JSON -> ${outFile}`);
  console.log("\nSummary:");
  for (const [name, { count }] of Object.entries(result)) {
    console.log(`   ${name.padEnd(9)} ${count}`);
  }
}

main().catch((e) => {
  console.error("\nSpike failed:", e.message ?? e);
  process.exit(1);
});
