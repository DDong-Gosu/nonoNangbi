# Spike 3 Result — Browser Extension + Native Messaging

**Verdict: PARTIAL (both halves proven separately; full in-browser load not run)**

## Summary

The two hard parts each work: (1) the content-script DOM extractor pulls correct
usage from the live Claude/Codex pages, and (2) the native-messaging host
correctly frames stdio messages into a JSONL bridge. They were not wired
together inside a real Chrome load (that needs the user to load the unpacked
extension and install the host manifest), so this is PARTIAL rather than PASS.

## Evidence

### DOM extraction (live pages)
`extract.js` evaluated against the real DOM of both open usage tabs:
- Claude: `shortRemaining 96, weeklyRemaining 85`, confidence high — **exact match**
  to the Phase G `verify:usage-source` read (96 / 85).
- Codex: `shortRemaining 65, weeklyRemaining 25`, confidence high (live values,
  drifted from earlier reads as usage changed).

CDP was used only as a test harness to inject + run the same JS; **a real content
script needs no CDP**. So this proves the extraction logic against production DOM.

### Native messaging host
`mongi_bridge.js` fed a length-prefixed JSON message → wrote
`extension-bridge.jsonl` and returned a framed `{ "ok": true }`. Protocol framing
(LE uint32 length + UTF-8 body) is correct.

### SPA / lifecycle handling
- `content.js`: initial extract + `MutationObserver` (debounced) for hydration +
  60s interval for idle pages; de-dupes and rate-limits sends.
- `background.js`: event-driven; `chrome.alarms` heartbeat instead of a banned
  long-lived timer (MV3 SW gets killed when idle); caches last usage in
  `chrome.storage` if the host is absent.

## Not done (why PARTIAL)

- The unpacked extension was **not loaded into the user's Chrome** (would require
  user action; the running Chrome profile is the CDP automation profile).
- Full round trip page → content script → SW → native host → JSONL not executed
  end-to-end in a browser.
- Arc/Edge not tested (Chromium-based, expected to work; Arc has quirks with
  native messaging host dirs).

## Install UX assessment vs CDP

- CDP today requires launching Chrome with `--remote-debugging-port` from a
  dedicated profile — fragile, scary-looking, breaks if the user opens normal
  Chrome.
- Extension UX: one-time "Load unpacked" (dev) or a store install, then it just
  works in the user's normal browser. **Better for a general user** once the
  native-host install is scripted. Native-host manifest install is the rough
  edge.

## V4 recommendation

**Promising general-web candidate, but needs more work before production.** It is
the most natural path for non-developer users (no CDP, runs in normal browser).
Before V4: (a) script the native-host manifest install, (b) load + verify the
full round trip in Chrome/Edge/Arc, (c) decide store vs dev-mode distribution
(store = review + maintenance). For V4, keep **CDP as the developer fallback**
while maturing the extension. Lower priority than statusLine/wham because those
already PASS and need no browser at all.
