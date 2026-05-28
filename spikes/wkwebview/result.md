# Spike 4 Result — WKWebView Backend

**Verdict: PARTIAL (mechanism works; login + background reliability unproven, high risk)**

## Summary

The WKWebView mechanism works: the Swift prototype compiles, loads real sites,
keeps a persistent cookie store, and extracts DOM text via `evaluateJavaScript`.
But the parts that actually make it a *backend* — logging into Claude/ChatGPT
inside the app, reaching the logged-in usage page, and reading reliably in the
background — were not validated and carry real product risk.

## Evidence (this machine)

- **Compile:** `swiftc MongiWebViewSpike.swift` → OK (Swift 6.3, arm64).
- **Public page:** loaded `https://example.com` → extracted
  `{title:"Example Domain", textLength:129}`. evaluateJavaScript works.
- **Claude usage (fresh cookie store):** `https://claude.ai/settings/usage`
  redirected to `https://claude.ai/login?from=logout`
  (`title:"Sign in - Claude"`, textLength 1964, `hasTurnstile:false` on the login
  page). DOM extraction worked on whatever page was shown.

## Findings

- WKWebView has its **own cookie jar**, separate from the user's Safari/Chrome.
  So the user must log in **again inside the Mongi app** — a real UX cost and a
  trust ask (entering ChatGPT/Claude credentials in a third-party app window).
- Persistent store (`WKWebsiteDataStore.default()`) should keep the session
  across restarts once logged in, but this was not verified end-to-end.

## Risks (all unverified but well-known)

- **Login friction / trust:** users must authenticate inside Mongi; OAuth/SSO
  (Google/Apple sign-in) often behaves poorly in embedded webviews.
- **Bot detection:** ChatGPT/Codex login and some flows use Cloudflare
  Turnstile; embedded WKWebViews are more likely to be challenged or blocked.
- **2FA/SSO:** popup/redirect handling adds complexity.
- **Background suspension/throttling:** hidden/minimized WKWebViews and app
  background state throttle timers and may suspend JS — bad for periodic idle
  polling, which is Mongi's core loop.

## V4 recommendation

**Lowest-priority candidate; recommend NOT pursuing as a primary backend.** It
has the nicest "feel" on paper but the worst risk profile (in-app login, bot
detection, background throttling) and is strictly heavier than the options that
already PASS. Since statusLine (Claude) and wham (Codex) both PASS browser-free,
and the extension covers general-web, WKWebView adds cost without unique value.
**Recommend parking it** (keep this prototype as reference) unless a future need
for a fully self-contained, no-CLI, no-extension GUI experience emerges — at
which point background-read reliability must be the first thing proven.
