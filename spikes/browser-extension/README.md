# Spike 3 — Browser Extension + Native Messaging

Goal: read Claude/Codex usage from the **real page DOM** (no CDP remote
debugging) and bridge it to Mongi via Native Messaging.

## Components

```
extension/
  manifest.json   MV3, host_permissions limited to the two usage URLs only
  extract.js      DOM usage extractor (shared, CDP-testable)
  content.js      runs in-page; extracts + handles SPA hydration/mutations
  background.js   service worker; forwards to native host; alarms heartbeat
native-host/
  mongi_bridge.js native messaging host (stdio length-prefixed framing -> JSONL)
  mongi_bridge.sh launcher (Chrome needs an executable path)
  com.mongi.bridge.json  host manifest template
```

## Output

`~/Library/Application Support/Mongi/spikes/extension-bridge.jsonl`
(override with `MONGI_BRIDGE_OUT_DIR`).

## Install (dev mode, not exercised in this spike)

1. `chrome://extensions` → enable Developer mode → Load unpacked → `extension/`.
2. Copy the generated extension ID.
3. Edit `com.mongi.bridge.json`: set absolute `path` to `mongi_bridge.sh` and
   `allowed_origins` to `chrome-extension://<ID>/`.
4. Install host manifest:
   `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.mongi.bridge.json`
   (Edge/Arc use their own NativeMessagingHosts dirs).
5. Open the usage pages; the content script extracts and the host appends JSONL.

## What was verified here

- `extract.js` run against the **live DOM** of both usage pages (via CDP only as
  a test harness — production uses no CDP) returned correct high-confidence
  values.
- `mongi_bridge.js` native-messaging framing tested with a length-prefixed
  message → JSONL written, framed `{ok:true}` returned.

## Security

- `host_permissions` are limited to exactly the two usage URLs — no broad web
  access.
- Native host writes only usage numbers; no tokens/cookies are read or sent.
