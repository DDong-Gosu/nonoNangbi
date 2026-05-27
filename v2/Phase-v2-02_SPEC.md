# Phase-v2-02_SPEC.md

## Phase-v2-02 — Discord Notification Simplification

## 0. Purpose

Phase-v2-02 simplifies Mongi's Discord notification system for V2.

Phase-v2-01 established the Git Output Status Core.

The core output status now uses only:

- NO_OUTPUT
- LOCAL_ONLY
- SHIPPED

Phase-v2-02 must update Discord notifications so they are based primarily on this V2 output status model.

The main product question remains:

Did you ship today?

Discord messages should become short, clear, and action-oriented.

This phase also introduces persistent phase report files so later V2 phases can continue from previous work without relying only on chat history.

---

## 1. Previous phase dependency

Before starting, inspect the Phase-v2-01 result.

Expected Phase-v2-01 behavior:

- src/output/gitOutputStatus.js exists
- outputStatus is one of NO_OUTPUT, LOCAL_ONLY, SHIPPED
- status:json exposes an output field
- quiet hours is exposed as a modifier, not a core status
- monitor and health commands passed
- current repo may show LOCAL_ONLY due to existing local work
- remote/GitHub today detection currently uses upstream commit date proxy
- live GitHub push event time is not verified

If a report file from Phase-v2-01 exists, read it.

Expected possible location:

- docs/phases/reports/phase-v2-01_REPORT.md

If it does not exist, use the current implemented code and README as the source of truth. Do not recreate Phase-v2-01 unless needed to understand V2-02.

---

## 2. New reporting requirement

Starting with Phase-v2-02, every phase must create a persistent report file.

For this phase, create:

- docs/phases/reports/phase-v2-02_REPORT.md

If the reports directory does not exist, create it.

The report file must contain the same completion report that is returned to the user.

The report should help future phases understand:

- what changed
- what commands were run
- what behavior was verified
- what remains unverified
- what next phase should do

Do not include secrets, webhook URLs, .env contents, cookies, session data, or access tokens in the report.

---

## 3. Current problem

Existing Discord notifications may still reflect V1 behavior.

Potential problems:

- messages may be too long
- messages may include complex next action wording
- messages may focus too much on AI session state
- messages may focus too much on usage warning state
- quiet hours may be treated like a status instead of a notification modifier
- Discord notification behavior may not cleanly use the new outputStatus field
- start action may not send a clear Discord confirmation
- background monitor runs may risk noisy notifications

V2 needs Discord notifications to be simple.

The user should understand the current state in three lines or fewer.

---

## 4. Core goal

Refactor Discord notification content and notification selection logic around the V2 output status model.

Core statuses:

- NO_OUTPUT
- LOCAL_ONLY
- SHIPPED

Discord messages must be short.

Maximum message length:

- 3 lines or fewer

Primary signal:

- Git output status

Secondary signal:

- exact AI usage percentage if available

Not primary:

- AI session status
- next action text
- warning level
- token/session interpretation

---

## 5. Message principles

Discord notifications should follow these principles:

1. Short
2. Clear
3. Status-first
4. No guilt language
5. No long coaching paragraphs
6. No complex next action explanation
7. No AI-session-heavy wording
8. No secrets
9. No raw debug dumps
10. No webhook URL in logs or reports

The tone should be firm but not insulting.

Avoid meanings like:

- You did nothing today.
- You wasted your usage.
- You failed.

Prefer meanings like:

- No shipped output detected today.
- Local work exists. Ship it today.
- GitHub output detected today.

---

## 6. Required Discord message states

Implement or update message templates for these cases:

### 6.1 Start notification

When the user starts Mongi from the app/menu bar/start flow, Discord should be able to send a start confirmation.

The message must be 3 lines or fewer.

It should communicate:

- Mongi started
- it is watching Git output
- refresh cadence if available

If the current codebase does not yet have a menu bar Start action wired to Node, implement the notification function and expose it through the closest existing start command or app integration point.

Do not invent a large UI system in this phase.

If the actual menu bar Start wiring is not available yet, report it as not fully verified.

---

### 6.2 NO_OUTPUT notification

NO_OUTPUT means no shipped or local Git output was detected.

Message should communicate:

- status is NO_OUTPUT
- no shipped/local Git output detected
- usage percentage if available

Do not imply the user did nothing.

---

### 6.3 LOCAL_ONLY notification

LOCAL_ONLY means local work exists but shipped evidence was not detected.

Message should communicate:

- status is LOCAL_ONLY
- local work exists
- user should ship/push today
- usage percentage if available

---

### 6.4 SHIPPED notification

SHIPPED means shipped evidence was detected today.

Message should communicate:

- status is SHIPPED
- Git output was detected today
- usage percentage if available

---

## 7. Usage percentage rule

If short/weekly usage percentage is available, include exact percentages compactly.

The usage line must remain short.

Usage is secondary.

Usage must not determine the core output status.

If one provider is unavailable, do not make the whole message fail.

If usage data is missing, use a compact fallback or omit the usage line.

Do not include long usage explanations in Discord messages.

---

## 8. Three-line limit

Every Discord message generated in this phase must be 3 lines or fewer.

This applies to:

- start notification
- NO_OUTPUT notification
- LOCAL_ONLY notification
- SHIPPED notification
- dry-run output if it represents actual message text

Add a test or assertion that checks message line count where practical.

If existing Discord infrastructure sends embeds or structured payloads, the visible text content should still satisfy the 3-line principle.

---

## 9. Quiet hours rule

Quiet hours must not change outputStatus.

Quiet hours may affect:

- whether a Discord notification is sent
- whether notification is marked as muted/suppressed
- notification policy decision

Quiet hours must not produce a separate core Discord status such as QUIET_HOURS.

If quiet hours suppresses a notification, logs should make it clear that the notification was suppressed because of quiet hours.

Do not spam Discord during quiet hours.

---

## 10. Refresh and background notification rule

This phase should not implement refresh cadence UI.

However, notification behavior must be safe for future background refresh.

Separate these concepts if the code currently mixes them:

- refresh/check state
- decide whether notification is needed
- format notification
- send notification

A background monitor run should not blindly send a Discord message every time.

If the current monitor already has event-based notification rules, preserve them while changing message content.

If notification spam risk exists, document it in the report.

---

## 11. AI session / next action removal from Discord

Discord messages should not depend on complex V1 next action wording.

Remove or bypass Discord text that includes:

- complex nextAction explanations
- AI session-heavy status
- verbose warning interpretation
- long coaching messages

It is acceptable to keep internal fields for compatibility.

The user-facing Discord message should be V2-style.

---

## 12. Implementation scope

In scope:

- Discord message templates
- notification formatter
- start notification path if currently available
- dry-run Discord message output
- notification tests
- line-count checks
- usage percentage formatting
- quiet hours notification suppression/marking
- report file creation
- minimal README update if Discord behavior docs are outdated

Out of scope:

- refresh cadence UI
- popover auto refresh
- short/weekly usage bars in UI
- reset countdown UI
- Codex/Claude cards
- packaging scripts
- TUI removal
- Browser cookie import
- OAuth/API migration
- GitHub OAuth
- GitHub App
- external server
- Chrome Extension
- rewriting Phase-v2-01 Git status logic

---

## 13. Expected files to inspect

Inspect the codebase for:

- Discord webhook sender
- message formatter
- notification dispatcher
- monitor entrypoint
- dry-run notification mode
- status-json script
- health check script
- app/menu bar start integration if present
- tests related to Discord or notification messages
- README notification docs
- Phase-v2-01 report if present

Likely search terms:

- discord
- webhook
- notification
- message
- nextAction
- warning
- quiet
- outputStatus
- dry-run
- start
- menu

Actual file names may differ. Follow the repo structure.

---

## 14. Validation commands

Run relevant commands and inspect outputs.

Required commands if available:

- npm run test:discord
- npm run monitor -- --dry-run-notifications
- npm run monitor
- npm run health
- npm run status:json

Also run syntax checks for changed JavaScript files.

If a command does not exist:

- inspect package.json
- choose the closest available substitute
- report the substitution

If real Discord delivery is unavailable or unsafe:

- use dry-run or mock mode
- clearly report that real delivery was not verified

Do not expose webhook URL.

---

## 15. Test requirements

Add or update tests for:

1. NO_OUTPUT Discord message
   - 3 lines or fewer
   - status appears
   - no complex nextAction text

2. LOCAL_ONLY Discord message
   - 3 lines or fewer
   - status appears
   - action is short and ship-oriented

3. SHIPPED Discord message
   - 3 lines or fewer
   - status appears
   - positive shipped evidence wording

4. Start notification
   - 3 lines or fewer
   - start confirmation appears
   - does not expose secrets

5. Usage percentage
   - exact percentage appears if available
   - missing usage does not break message generation

6. Quiet hours
   - outputStatus remains unchanged
   - notification is suppressed or marked according to policy

If full integration tests are difficult, add formatter-level tests and report what was not integration-tested.

---

## 16. README update

If README currently describes old long Discord warning behavior, update it briefly.

README should reflect:

- Discord messages are now V2 output-status based
- messages use NO_OUTPUT, LOCAL_ONLY, SHIPPED
- Discord messages are intentionally short
- AI usage percentage is secondary
- quiet hours affects notification policy, not core status

Do not do a full README rewrite in this phase.

---

## 17. Success criteria

Phase-v2-02 is complete when:

1. Discord messages are based primarily on V2 outputStatus.
2. NO_OUTPUT, LOCAL_ONLY, and SHIPPED have short message templates.
3. Discord messages are 3 lines or fewer.
4. Exact usage percentage is included when available.
5. AI session and complex nextAction wording are removed from user-facing Discord messages.
6. Quiet hours does not become a core status.
7. Start notification is implemented or the unavailable integration point is clearly reported.
8. Tests or assertions cover message formatting.
9. Relevant commands are run and inspected.
10. docs/phases/reports/phase-v2-02_REPORT.md is created.
11. The final chat report matches the saved report.
12. No secrets are printed.

---

## 18. Completion report format

At the end, save the report to:

- docs/phases/reports/phase-v2-02_REPORT.md

Then report the same content in chat.

Use exactly this format:

Phase-v2-02 Report

1. Files created/changed
- ...

2. Discord message model
- ...

3. Message templates implemented
- Start:
- NO_OUTPUT:
- LOCAL_ONLY:
- SHIPPED:

4. Usage percentage handling
- ...

5. Quiet hours handling
- ...

6. Start notification handling
- ...

7. Tests / assertions
- ...

8. Commands run
- ...

9. Output / log summary
- ...

10. Failed / Not verified
- ...

11. Report file
- docs/phases/reports/phase-v2-02_REPORT.md

12. Next recommended phase
- Phase-v2-03 — Menu Bar Refresh & Cadence

---

## 19. Final judgment

This phase should make Discord feel like a sharp status signal, not a verbose dashboard.

The core Discord question is:

Did you ship today?

The message should answer that in three lines or fewer.