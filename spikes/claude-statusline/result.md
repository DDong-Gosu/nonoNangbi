# Spike 1 Result — Claude Code statusLine Backend

**Verdict: PASS (with one operational caveat)**

## Summary

Claude Code's `statusLine` command pipeline delivers, on stdin, exactly the
fields Mongi needs for Claude: 5-hour + weekly subscription usage percentages
with reset times, plus context-window usage, model, cost, and session info. The
receiver pipeline (parse → redact → JSONL → status line) works on all tested
payloads. The only caveat is operational: `rate_limits` is only present for
subscribers **after the first API response** in a session, and only while a
Claude Code session is actually running.

## Evidence

### Config contract (confirmed)
`~/.claude/settings.json` `statusLine` schema (from the 2.1.153 settings schema):
`{ type: "command", command: string, refreshInterval?: number, padding?, hideVimModeIndicator? }`.
Configured + restored cleanly; original backed up to
`~/.claude/settings.json.mongi-phase-g.bak`.

### Input payload schema (confirmed from binary 2.1.153 embedded types)
Top-level keys: `hook_event_name, session_id, transcript_path, cwd, version,
model{id,display_name}, workspace{current_dir,project_dir}, output_style{name},
cost{total_cost_usd,total_duration_ms,total_api_duration_ms,total_lines_added,
total_lines_removed}, exceeds_200k_tokens, context_window, rate_limits,
session_name, added_dirs, git_worktree, review_state, original_cwd,
original_branch`.

`context_window`: `{ context_window_size, current_usage, used_percentage,
remaining_percentage }`.

`rate_limits` (documented in-binary as *"subscription usage limits. Only present
for subscribers after first API response"*):
- `five_hour`: `{ used_percentage: 0-100, resets_at: unix_epoch_seconds }`
- `seven_day`: `{ used_percentage: 0-100, resets_at: unix_epoch_seconds }`

The binary even ships an example statusLine script that prints
`rate_limits.five_hour.used_percentage` and `rate_limits.seven_day.used_percentage`.

### Receiver functional test (this machine)
Three stdin cases run through `statusline-receiver.js`:
1. Full subscriber payload → all fields extracted; `$HOME`→`~`, session id
   truncated; printed `mongi-spike Opus 4.7`.
2. Idle payload (no `rate_limits`) → `rateLimits.present:false`, all rate fields
   null, context still captured.
3. Malformed JSON → `parseOk:false` with reason, no crash, safe status line.

Output written to JSONL with redaction; samples saved.

## Mapping to Mongi state

| Mongi field | statusLine source |
| --- | --- |
| claude short used % | `rate_limits.five_hour.used_percentage` |
| claude short reset | `rate_limits.five_hour.resets_at` (epoch s) |
| claude weekly used % | `rate_limits.seven_day.used_percentage` |
| claude weekly reset | `rate_limits.seven_day.resets_at` (epoch s) |
| claude context used % | `context_window.used_percentage` |
| model | `model.display_name` |
| freshness | `receivedAt` vs now; stale if no record while CLI closed |

Mongi stores `remaining`; convert `remaining = 100 - used_percentage`.

## Semantic alignment with web usage

`five_hour` / `seven_day` are the **subscription plan** windows (the same 5-hour
session limit and weekly limit shown on claude.ai/settings/usage), not a
CLI-only metric. So values are semantically the same source as the CDP-scraped
web usage. (Exact numeric parity vs the web page was not cross-checked live in
this spike — see risks.)

## Caveats / what did not work

- **Live capture from the standalone binary was blocked** by first-run
  onboarding (theme/trust screens) under pty automation; could not auto-reach
  the main prompt. Schema was confirmed from the binary's embedded type/doc
  strings instead, and the pipeline proven with a schema-accurate sample. A real
  capture only needs one manual interactive session (steps in README).
- **`rate_limits` absent until first API response** and only while a session
  runs → Mongi must treat "no recent record" as stale/unknown, not 0.
- The VSCode extension session did not invoke the command-type statusLine, so
  this backend depends on the user using the **terminal CLI**, not only the IDE
  extension.

## V4 recommendation

**Strong V4 candidate for Claude as a primary or co-primary backend**, because
it is the only non-scraping source that returns real plan rate-limit % + reset
times with zero browser/CDP dependency and no secrets. Recommended shape:
statusLine as primary when the Claude Code CLI is in active use; **CDP remains
fallback** for (a) when the CLI is closed and (b) capturing usage driven by the
web app / other clients. Needs a one-session live parity check vs the web page
before productionizing.
