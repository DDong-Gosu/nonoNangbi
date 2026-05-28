#!/usr/bin/env node
"use strict";

// Phase G Spike 2 probe — Codex wham usage backend.
//
// Reads ~/.codex/auth.json (the Codex CLI / ChatGPT local auth file) and calls
// the private endpoint https://chatgpt.com/backend-api/wham/usage to fetch
// subscription rate-limit / reset info WITHOUT a browser or CDP.
//
// Security (Phase G rules):
//   - access token / id_token / refresh_token are used in memory only,
//     never written to disk and never printed.
//   - account_id is treated as sensitive: never printed, only presence noted.
//   - the raw response is redacted before any sample is saved.
//   - this is a PRIVATE, undocumented endpoint -> RISK (see result.md).
//
// File read: ~/.codex/auth.json
//   purpose: obtain tokens.access_token + tokens.account_id to authenticate
//   the same way the Codex CLI does (Authorization: Bearer + chatgpt-account-id).

const fs = require("fs");
const os = require("os");
const path = require("path");

const AUTH_PATH = path.join(os.homedir(), ".codex", "auth.json");
const WHAM_URL = "https://chatgpt.com/backend-api/wham/usage";
const SAVE_SAMPLE = process.argv.includes("--save-sample");
const SAMPLE_PATH = path.join(__dirname, "sample-response.redacted.json");

function jwtExpiryAndPlan(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString("utf8")
    );
    const exp = payload.exp ? new Date(payload.exp * 1000).toISOString() : null;
    const plan =
      payload["https://api.openai.com/auth.chatgpt_plan_type"] || null;
    const expired = payload.exp ? payload.exp * 1000 < Date.now() : null;
    return { exp, expired, plan };
  } catch (_) {
    return { exp: null, expired: null, plan: null };
  }
}

// Redact a response object: drop anything id/token/email-like, keep only
// rate-limit shaped numeric fields.
const SENSITIVE_KEY = /token|secret|email|account|user|id$|_id|cookie|auth/i;
function redact(obj) {
  if (Array.isArray(obj)) return obj.map(redact);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEY.test(k) && typeof v !== "object") {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return obj;
}

function summarizeWindow(w) {
  if (!w || typeof w !== "object") return null;
  const resetAt = w.reset_at ?? w.resets_at ?? null;
  const windowSeconds = w.limit_window_seconds ?? null;
  return {
    used_percent: w.used_percent ?? null,
    remaining_percent:
      typeof w.used_percent === "number" ? 100 - w.used_percent : null,
    window_minutes:
      typeof windowSeconds === "number" ? Math.round(windowSeconds / 60) : null,
    reset_after_seconds: w.reset_after_seconds ?? null,
    reset_at: resetAt,
    reset_at_iso:
      typeof resetAt === "number"
        ? new Date(resetAt * 1000).toISOString()
        : null,
  };
}

async function main() {
  const result = {
    probedAt: new Date().toISOString(),
    authFile: { path: "~/.codex/auth.json", exists: false },
    credentials: {},
    request: { url: WHAM_URL, ok: false, status: null, error: null },
    parsed: null,
  };

  if (!fs.existsSync(AUTH_PATH)) {
    result.request.error = "auth.json not found";
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }
  result.authFile.exists = true;

  let auth;
  try {
    auth = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
  } catch (e) {
    result.request.error = "auth.json parse failed";
    console.log(JSON.stringify(result, null, 2));
    process.exit(2);
  }

  const accessToken = auth?.tokens?.access_token;
  const accountId = auth?.tokens?.account_id;
  result.credentials = {
    authMode: auth?.auth_mode || null,
    hasAccessToken: !!accessToken,
    hasAccountId: !!accountId,
    ...(accessToken ? jwtExpiryAndPlan(accessToken) : {}),
  };

  if (!accessToken || !accountId) {
    result.request.error = "missing access_token or account_id";
    console.log(JSON.stringify(result, null, 2));
    process.exit(3);
  }

  // headers mirror what the Codex CLI core sends. Token/account_id are in
  // memory only and never logged.
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "chatgpt-account-id": accountId,
    "OpenAI-Beta": "responses=experimental",
    originator: "codex_cli_rs",
    "User-Agent": "codex_cli_rs/0.0.0 (mongi-phase-g-spike)",
    Accept: "application/json",
  };

  try {
    const res = await fetch(WHAM_URL, { method: "GET", headers });
    result.request.status = res.status;
    result.request.ok = res.ok;
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (_) {
      body = { _nonJson: text.slice(0, 200) };
    }

    if (res.ok && body && typeof body === "object") {
      // Tolerant extraction: the wham payload nests rate-limit windows under a
      // few possible shapes. Try the known ones.
      const rl = body.rate_limit || body.rate_limits || body.usage || body;
      const primary = rl.primary_window || rl.primary;
      const secondary = rl.secondary_window || rl.secondary;
      result.parsed = {
        topLevelKeys: Object.keys(body),
        plan_type: body.plan_type || null,
        limit_reached: rl.limit_reached ?? null,
        primary: summarizeWindow(primary),
        secondary: summarizeWindow(secondary),
      };
      if (SAVE_SAMPLE) {
        fs.writeFileSync(
          SAMPLE_PATH,
          JSON.stringify(redact(body), null, 2) + "\n"
        );
        result.savedRedactedSample = path.basename(SAMPLE_PATH);
      }
    }
  } catch (e) {
    result.request.error = e.message;
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
