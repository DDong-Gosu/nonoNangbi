# V3.1 Phase G Report — Local Direct Backend Spike

Date: 2026-05-28
Scope: short, independent validation of backend candidates that could replace or
supplement the CDP backend. **No production switch. CDP not removed.**

---

## 1. Files created / changed

Created (spikes — isolated from production path):

- `spikes/claude-statusline/` — `statusline-receiver.js`, `sample-input.json`,
  `sample-output.json`, `sample-output.jsonl`, `README.md`, `result.md`
- `spikes/codex-wham/` — `probe.js`, `sample-response.redacted.json`,
  `README.md`, `result.md`
- `spikes/browser-extension/` — `extension/{manifest.json, extract.js,
  content.js, background.js}`, `native-host/{mongi_bridge.js, mongi_bridge.sh,
  com.mongi.bridge.json}`, `README.md`, `result.md`
- `spikes/wkwebview/` — `MongiWebViewSpike.swift`, `README.md`, `result.md`
  (compiled `mongi-webview-spike` is gitignored)
- `v3.1/reports/phase-g_REPORT.md` (this file)

Changed (non-production):

- `.gitignore` — ignore the compiled WKWebView spike binary.

**No production source files were modified.** CDP backend untouched.

Temporary, reverted:

- `~/.claude/settings.json` — `statusLine` added then **restored**; backup kept
  at `~/.claude/settings.json.mongi-phase-g.bak`.

Spike runtime outputs (outside repo):
`~/Library/Application Support/Mongi/spikes/{claude-statusline.jsonl,
extension-bridge.jsonl}`.

---

## 2. Preflight results

| Check | Result |
| --- | --- |
| V3.0.1 hotfix complete | ✅ report present, RC built, all checks passed |
| `npm run health` | ✅ pass (launchd plist missing — known, see hotfix report) |
| `npm run status:json` | ✅ pass |
| `npm run verify:usage-source` | ✅ pass — exact-URL reload-read, both fresh |
| CDP matches live page | ✅ Codex & Claude `fresh_verified_exact_url_reload_read`, verify == status-json |
| Monitor duplicate runs | ✅ none — single app-owned loop (`Mongi.app/.../monitor.js --loop --dry-run`) |
| launchd duplicate | ✅ no standalone daemon (only the GUI app registration) |
| `dist/Release/Mongi.app` | ✅ present (v3.0.1-rc.1) |
| RC zip | ⚠️ `dist/Mongi-v3-rc.1.zip` present; no `Mongi-v3.0.1-rc.1.zip` (minor naming) |
| Secrets in state/logs | ✅ none found |

Preflight passed; proceeded to spikes.

---

## 3. Spike summary

| Spike | Verdict | One-line |
| --- | --- | --- |
| 1 Claude statusLine | **PASS** | Official JSON pipeline delivers 5h+weekly % + reset + context, no browser |
| 2 Codex wham | **PASS** | `wham/usage` returns exact 5h+weekly quota/reset, browser-free (private endpoint) |
| 3 Browser Extension | **PARTIAL** | DOM extract + native host each proven; full in-browser load not run |
| 4 WKWebView | **PARTIAL** | Loads + extracts DOM; login + background reliability unproven, high risk |

Excluded as instructed: Cursor SQLite, HTTPS proxy, OCR/Accessibility, embedded
Chromium.

---

## 4. Claude statusLine result (PASS)

- Config contract confirmed (`statusLine: {type:"command", command, refreshInterval}`).
- Input payload schema confirmed from Claude Code 2.1.153 binary: includes
  `context_window {used_percentage, remaining_percentage, ...}` and **`rate_limits`**.
- `rate_limits.five_hour` / `rate_limits.seven_day` → `{ used_percentage,
  resets_at }`. Documented in-binary as *"subscription usage limits, only present
  for subscribers after first API response"* — i.e. the real plan limits, same
  source as the web usage page.
- Receiver pipeline tested on full / idle / malformed payloads: extracts, redacts
  (`$HOME`→`~`, session id truncated), writes JSONL, never crashes.
- Caveats: present only after first API response and only while the CLI runs; the
  VSCode extension session does not invoke command-type statusLine (terminal CLI
  required). Live capture from the standalone binary was blocked by first-run
  onboarding under pty automation; schema proven from the binary instead.

→ Strong Claude V4 candidate. Needs a one-session live parity check vs web.

## 5. Codex wham result (PASS)

- `~/.codex/auth.json` has `access_token` (valid, exp 2026-06-04) + `account_id`.
- `GET https://chatgpt.com/backend-api/wham/usage` → **200**.
- `rate_limit.primary_window`: used 30% / remaining 70%, 5h window, reset
  2026-05-28T13:36Z. `rate_limit.secondary_window`: used 74% / remaining 26%, 7d
  window, reset 2026-06-01T03:28Z. `plan_type: plus`.
- Cross-check vs CDP/web (preflight): 5h remaining 70 vs 71 (live drift), weekly
  26 vs 26 (exact). **Same source as web usage.**
- Tokens used in memory only, never printed/saved; saved sample fully redacted
  (no JWT/account/email).
- Risk: **private undocumented endpoint** + token-refresh handling needed.

→ Strong Codex V4 candidate for personal use, behind CDP fallback.

## 6. Browser Extension result (PARTIAL)

- `extract.js` run against the live DOM of both usage pages: Claude 96/85
  (exact match to verify), Codex 65/25, both high confidence. (CDP used only as a
  test harness; the content script needs no CDP.)
- Native host `mongi_bridge.js`: length-prefixed stdio framing → JSONL written,
  framed `{ok:true}` returned.
- MV3 SW lifecycle handled via `chrome.alarms` heartbeat; content script handles
  SPA hydration via debounced `MutationObserver` + interval.
- Not run: unpacked extension loaded in a real browser; full page→SW→host round
  trip; Arc/Edge. Native-host manifest install is the rough edge.

→ Best general-web (non-CLI) path, but more work before V4.

## 7. WKWebView result (PARTIAL)

- Swift prototype compiles (Swift 6.3); loads `example.com` and extracts DOM
  (`evaluateJavaScript` works); persistent cookie store wired.
- Claude usage URL (fresh store) redirected to login ("Sign in - Claude") — the
  webview has its own cookie jar, so users must log in again in-app.
- Unverified + risky: in-app login/SSO, Cloudflare/bot detection, background
  suspension/throttling of the polling loop.

→ Lowest priority; recommend parking.

---

## 8. Security / privacy review

- No tokens, cookies, or Authorization headers were printed or saved anywhere.
- Codex bearer/account/email redacted in the saved sample (verified zero
  JWT/email/hex32 in `sample-response.redacted.json`).
- statusLine payload carries no tokens; receiver still redacts paths/ids.
- Credential file reads documented: `~/.codex/auth.json` (purpose: bearer +
  account id), `~/.claude/settings.json` (purpose: statusLine config, backed up).
- Private endpoint (`wham/usage`) flagged as a risk.
- No commands injected into the user's real CLI session (a separate throwaway TUI
  in a temp dir was used and never reached the prompt).
- Extension `host_permissions` limited to the two exact usage URLs.
- `spikes/` secret scan: clean.

---

## 9. Decision matrix

Weights: Product feel 25%, Reliability 25%, Implementation complexity 15%,
Maintainability 15%, Security/trust 20%. Scores 1–5 (5 best; for "complexity",
5 = simplest).

| Backend | Product feel | Reliability | Imp. complexity | Maintainability | Security/trust | **Weighted** | Recommendation |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| Claude statusLine | 4 | 4 | 4 | 5 | 5 | **4.35** | Claude primary (+CDP fallback) |
| Browser Extension | 4 | 4 | 2 | 3 | 4 | **3.55** | General-web path; mature later |
| Codex wham | 5 | 3 | 4 | 2 | 3 | **3.50** | Codex primary, personal (+CDP fallback) |
| CDP current | 2 | 3 | 3 | 3 | 4 | **2.95** | Keep as fallback |
| WKWebView | 3 | 2 | 2 | 2 | 2 | **2.25** | Park / discard as primary |

---

## 10. Recommended V4 backend strategy

- **Claude:** statusLine as primary when the Claude Code CLI is in active use;
  **CDP fallback** when the CLI is closed or for web/other-client usage.
- **Codex:** wham as primary (personal/advanced flag); **CDP fallback** on
  401/expiry/endpoint failure. Build a token-refresh path before productionizing.
- **General web / non-CLI users:** Browser Extension is the target UX; CDP stays
  the developer fallback while the extension matures.
- **CDP:** demoted to universal fallback, **not removed**.
- **WKWebView:** parked.

Net: V4 moves from "CDP for everything" to "best-source-per-service with CDP as
the safety net."

## 11. What to productionize

1. Claude statusLine backend (receiver → Mongi state adapter) + freshness/stale
   handling for "no record while CLI closed".
2. Codex wham backend (probe → Mongi state adapter) + token-refresh + graceful
   fallback to CDP.

## 12. What to discard

- WKWebView as a primary backend (keep prototype only for reference).
- Already-excluded approaches: Cursor SQLite, HTTPS proxy, OCR/Accessibility,
  embedded Chromium.

## 13. What remains fallback

- **CDP** for both services (developer fallback / when primaries are
  unavailable). Do not remove.

## 14. Remaining risks

- statusLine: only after first API response + only while CLI runs; not invoked by
  the IDE extension; live parity vs web not yet measured.
- wham: private endpoint may change/break; token refresh unimplemented; aggressive
  polling could trip anti-abuse.
- Extension: full in-browser round trip + multi-browser unverified; native-host
  install UX; possible store-review/maintenance burden.
- RC artifact naming inconsistency (`Mongi-v3-rc.1.zip` vs expected `v3.0.1`).

## 15. Next phase recommendation

- **V3.1 Phase H — Claude statusLine production adapter** (primary + CDP
  fallback), including a one-session live parity check vs the web usage page.
- **V3.1 Phase I — Codex wham production adapter** with token-refresh + CDP
  fallback, behind an advanced/personal flag.
- Defer the browser extension to a later phase (script native-host install +
  verify full round trip in Chrome/Edge/Arc) once the two CLI/local backends ship.
- Keep CDP as the maintained fallback throughout.
