# AGENTS.md

## Purpose

This file is for AI coding agents working on Mongi Usage Coach.

Do not treat this as a README.  
Only keep rules that are easy for an agent to miss by reading code.

---

## Required reading order

Before coding, read in this order:

1. `MVP_SPEC.md`
2. `DESIGN.md`
3. The current phase spec, for example `phase-a-01_SPEC.md`

If the current phase spec conflicts with `MVP_SPEC.md`, follow the phase spec only when it is clearly narrower and implementation-specific.  
If it changes product intent, stop and report the conflict.

---

## Core invariant

This project is not a SaaS, dashboard, or public product.

It is a personal usage coach that helps the user convert paid Codex/Claude subscriptions into actual development output.

Prefer:

- working local automation
- clear logs
- reliable Discord notifications
- low-cost operation
- simple file-based state

Avoid:

- web dashboards
- databases
- auth systems
- SaaS architecture
- unnecessary UI
- paid infrastructure by default

---

## Security rules

Never commit or hardcode:

- Discord Webhook URLs
- `.env`
- `browser-profile/`
- cookies
- Playwright session data
- `state.json`
- `logs/`

Required:

- `.env.example` must contain only empty placeholder values.
- `.gitignore` must block `.env`, `browser-profile/`, `logs/`, and `data/state.json`.
- Webhook URL must only come from environment variables.

If a secret appears in code, stop and remove it before continuing.

---

## Agent execution rule

Do not only write code.  
Run the relevant command and inspect the result.

For every task, complete this loop:

1. Implement
2. Run
3. Inspect logs/output
4. Fix if needed
5. Report changed files and commands run

Never report “should work” unless it was actually executed or there is a clear reason execution is impossible.

---

## Build / run / validation commands

Use these commands unless `package.json` defines a better exact script.

- Install: `npm install`
- Discord smoke test: `npm run test:discord`
- Login session setup: `npm run login`
- Debug page text: `npm run debug:page-text`
- One monitor run: `npm run monitor`
- Mock scenario validation: `npm run test:scenarios`
- Lint, if configured: `npm run lint`
- Format, if configured: `npm run format`

Do not use watch-mode commands for validation.

---

## Playwright usage extraction policy

Start with the simplest reliable extraction method, but do not stop at the first failure.

Preferred order:

1. `body.innerText()`
2. DOM selector search
3. accessibility snapshot
4. headless false comparison
5. service-specific parser fallback
6. degraded mode with clear diagnostic logs

If Codex parsing fails, Claude monitoring must still run.  
If Claude parsing fails, Codex monitoring must still run.

A single service failure must not crash the entire monitor.

---

## Parser rules

Codex and Claude parsers must remain separate.

Each parser should return a normalized result object with:

- service key
- service name
- short window percent, if found
- weekly percent, if found
- parse method
- parse confidence
- raw text sample for diagnostics
- error reason, if failed

Do not mix Codex-specific assumptions into the Claude parser.

---

## Event rules

Do not send notifications while usage is actively decreasing.

Send Discord notifications only for these event types:

- short-window 100% recovery
- weekly 100% recovery
- session stopped after idle threshold
- weekly 100% idle reminder
- limited diagnostic failure digest

Avoid repeated spam.

Required duplicate prevention:

- Recovery alert only when previous percent was below 100 and current percent is 100.
- Session stopped alert only once per usage session.
- Weekly idle reminder only after configured reminder interval.
- Parse failure digest must be rate-limited.

---

## State rules

Use file-based state.

State writes must be safe:

- If state file is missing, create it.
- If state file is corrupt, back it up or regenerate safely.
- Do not erase usable previous state silently.
- Keep state schema versioned.

State should support both real parser output and mock scenario validation.

---

## Quiet hours

Default quiet hours: 23:00–08:00 local time.

During quiet hours:

- do not send normal Discord alerts
- still run checks
- still update state
- still write logs

Do not silently discard events unless the product rule explicitly says so.

---

## Mongi message rules

Messages must follow `DESIGN.md`.

Important:

- Use “몽이” / “몽!” lightly.
- Do not make the tone childish.
- Do not shame the user.
- Do not overuse motivational clichés.
- Always connect the alert to one small next action.

Every notification should answer:

“What should the user do next?”

---

## Failure handling

When something fails, classify it.

Use one of:

- missing env
- Discord webhook failure
- login/session expired
- page navigation failure
- parser failure
- network timeout
- state read/write failure
- unknown failure

Log the specific failure.  
Do not hide it behind a generic “failed” message.

---

## Phase completion report format

At the end of a phase, report:

1. Files created/changed
2. Commands run
3. What passed
4. What failed or remains uncertain
5. How to manually verify
6. Next recommended phase

Do not include secrets, webhook URLs, cookie data, or full raw page dumps in the report.

---

## Update rule

When the agent makes a mistake that should not happen again, add a short rule here.

Keep this file under 100 lines if possible.  
Remove obvious README-style content during cleanup.