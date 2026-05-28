# Spike 4 — WKWebView Backend

Goal: can an in-app WKWebView log in, reach the usage page, and extract DOM text?

## Files

- `MongiWebViewSpike.swift` — minimal standalone WKWebView tool
- `mongi-webview-spike` — compiled binary (not committed)
- `result.md` — PASS/PARTIAL/FAIL + evidence + risks

## Build & run

```
swiftc MongiWebViewSpike.swift -o mongi-webview-spike
./mongi-webview-spike "https://example.com" 4
./mongi-webview-spike "https://claude.ai/settings/usage" 7
```

arg1 = URL, arg2 = seconds to wait (SPA hydration) before extracting. Prints a
redacted JSON line (`url`, `title`, `textLength`, `percentTokens`,
`hasTurnstile`) then exits. Runs as an `.accessory` app (no dock icon).

## What this proves / does not

- Proves: WKWebView loads real sites, persistent cookie store is wired
  (`WKWebsiteDataStore.default()`), `evaluateJavaScript` extracts DOM text.
- Does NOT prove: logged-in usage extraction (needs interactive login — the
  webview has its own cookie jar, separate from the user's browser), background
  read reliability, or bot-detection behavior past login.

## Security

- App stores no credentials itself; relies on WKWebView's own persistent cookie
  store. No tokens printed.
