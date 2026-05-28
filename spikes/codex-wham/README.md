# Spike 2 — Codex Wham Usage Backend

Goal: fetch Codex subscription quota / reset **without a browser or CDP**, using
the local Codex auth file + the private `wham/usage` endpoint.

## Flow

```
~/.codex/auth.json
  -> tokens.access_token (JWT) + tokens.account_id
  -> GET https://chatgpt.com/backend-api/wham/usage
       Authorization: Bearer <access_token>
       chatgpt-account-id: <account_id>
       originator: codex_cli_rs
  -> rate_limit { primary_window, secondary_window }
  -> Mongi state (short / weekly remaining + reset)
```

This mirrors how the Codex CLI core (`bin/.../codex`) authenticates.

## Files

- `probe.js` — reads auth.json, calls wham/usage, redacts, prints summary
- `sample-response.redacted.json` — real response with all PII redacted
- `result.md` — PASS/PARTIAL/FAIL + evidence + risks + V4 recommendation

## Run

```
node probe.js                 # prints redacted summary only
node probe.js --save-sample   # also writes sample-response.redacted.json
```

## Security

- `access_token` / `id_token` / `refresh_token` used **in memory only**, never
  written, never printed.
- `account_id`, `user_id`, `email` are redacted in any saved sample.
- The file read is documented: `~/.codex/auth.json`, to obtain the bearer token
  + account id, same as the Codex CLI.
- **`wham/usage` is a private, undocumented endpoint** — see result.md RISK.
- Keep call frequency low (the official client refetches ~1/min; Mongi should
  poll far less often).
