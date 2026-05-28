# Spike 1 — Claude Code statusLine Backend

Goal: can Mongi receive Claude usage / rate-limit / context / model info via the
Claude Code `statusLine` JSON pipeline, without automating the TUI?

## What this is

Claude Code invokes a configured `statusLine` command on every TUI render and
passes a JSON payload on **stdin**. `statusline-receiver.js` reads that payload,
redacts path/id data, appends a normalized record to JSONL, and prints a short
status string back to the TUI.

This is NOT TUI scraping. It is the official, documented statusLine contract.

## Files

- `statusline-receiver.js` — stdin JSON → redact → JSONL → print status line
- `sample-input.json` — schema-accurate input (built from the confirmed schema)
- `sample-output.json` / `sample-output.jsonl` — receiver output (redacted)
- `result.md` — PASS/PARTIAL/FAIL + evidence + V4 recommendation

## How to reproduce

1. Back up settings: `cp ~/.claude/settings.json ~/.claude/settings.json.bak`
2. Add to `~/.claude/settings.json`:
   ```json
   "statusLine": {
     "type": "command",
     "command": "node /ABS/PATH/spikes/claude-statusline/statusline-receiver.js",
     "refreshInterval": 5
   }
   ```
3. Run an interactive Claude Code session and do at least one prompt
   (rate_limits only appear after the first API response).
4. Inspect output:
   `~/Library/Application Support/Mongi/spikes/claude-statusline.jsonl`
5. Restore: `cp ~/.claude/settings.json.bak ~/.claude/settings.json`

Offline test (no Claude session needed):
```
node statusline-receiver.js < sample-input.json
```

## Output location

`~/Library/Application Support/Mongi/spikes/claude-statusline.jsonl`
(override with `MONGI_STATUSLINE_OUT_DIR`).

## Safety

- Never overwrites `~/.claude/settings.json` without a backup.
- Redacts: `$HOME` → `~`, session id truncated. No tokens are present in the
  payload, and none are written.
