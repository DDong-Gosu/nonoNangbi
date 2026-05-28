# Spike 2 Result — Codex Wham Usage Backend

**Verdict: PASS (private-endpoint risk noted)**

## Summary

Using `~/.codex/auth.json` (bearer token + account id) the probe called
`https://chatgpt.com/backend-api/wham/usage` and got HTTP 200 with full
subscription rate-limit data: a 5-hour primary window and a 7-day secondary
window, each with `used_percent` and `reset_at`. Values match the CDP/web usage
read from preflight. No browser, no CDP, no token exposure.

## Evidence (this machine, live)

- `auth.json`: present; `auth_mode=chatgpt`; `access_token` + `account_id`
  present; token valid (`exp 2026-06-04`, not expired).
- Request: `GET /backend-api/wham/usage` → **200 OK**.
- Response top-level keys: `user_id, account_id, email, plan_type, rate_limit,
  code_review_rate_limit, additional_rate_limits, credits, spend_control,
  rate_limit_reached_type, promo, referral_beacon, rate_limit_reset_credits`.
- `plan_type: "plus"`.
- `rate_limit.primary_window`: `used_percent 30` (remaining 70),
  `limit_window_seconds 18000` (=5h), `reset_at 2026-05-28T13:36:10Z`.
- `rate_limit.secondary_window`: `used_percent 74` (remaining 26),
  `limit_window_seconds 604800` (=7d), `reset_at 2026-06-01T03:28:30Z`.

### Cross-check vs CDP/web (from Phase G preflight)
| Window | wham remaining | CDP/web remaining | Match |
| --- | --- | --- | --- |
| 5-hour | 70 | 71 | ✓ (live drift) |
| weekly | 26 | 26 | ✓ exact |

Semantically the **same source** as the Codex web usage page.

## Mapping to Mongi state

| Mongi field | wham source |
| --- | --- |
| codex short used/remaining % | `rate_limit.primary_window.used_percent` |
| codex short reset | `rate_limit.primary_window.reset_at` (epoch s) |
| codex weekly used/remaining % | `rate_limit.secondary_window.used_percent` |
| codex weekly reset | `rate_limit.secondary_window.reset_at` (epoch s) |
| plan | `plan_type` |

Endpoint also returns `credits` / `spend_control` for future use.

## Security / privacy

- Tokens never written or printed; only in-memory use.
- Saved sample has `user_id`, `account_id`, `email` redacted (verified: no JWT,
  no Bearer, no email, no raw account id present in the file).
- File read documented: `~/.codex/auth.json`.

## Risks

- **Private/undocumented endpoint.** OpenAI can change/rename/remove it or change
  auth without notice. Must be wrapped with graceful failure + CDP fallback.
- **Token expiry / refresh.** The probe does not refresh; on 401 it must fall
  back to CDP (or trigger a Codex CLI refresh out of band). Refresh-token flow is
  out of scope for this spike.
- **Anti-abuse / rate limiting.** One low-frequency call worked; aggressive
  polling could trip Cloudflare/anti-abuse. Keep Mongi polling ≪ 1/min.
- **ToS posture.** Reusing the CLI token against a private endpoint is a personal
  /advanced-backend use; not appropriate for broad public distribution.

## V4 recommendation

**Strong V4 candidate for Codex as the primary backend** for personal use: it is
faster, browser-free, and exact vs the web page. Recommended shape: wham primary
with **CDP fallback** on 401/expiry/endpoint failure. Because it depends on a
private endpoint, keep it behind a clear "advanced/personal" flag and never make
it the only path. A token-refresh strategy is the main pre-production work item.
