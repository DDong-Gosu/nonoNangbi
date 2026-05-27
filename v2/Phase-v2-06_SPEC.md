# Phase-v2-06_SPEC.md

## Phase-v2-06 — End-to-End QA Pass and Usage Tracking Accuracy Fix

## 0. Purpose

Phase-v2-06 is the final V2 QA pass.

Previous phases established:

- Phase-v2-01: Git Output Status Core
- Phase-v2-02: Discord Notification Simplification
- Phase-v2-03: Menu Bar Refresh & Cadence
- Phase-v2-04: Usage UI Bars, Reset Countdown, and Cards
- Phase-v2-05: Packaging and No-Terminal App Flow

Phase-v2-06 must verify the full product behavior end-to-end and fix issues found during QA.

A known issue must be investigated in this phase:

The app's usage tracking values do not match the actual usage pages.

The menu bar currently shows usage values that differ significantly from the real provider pages.

This phase is not only a smoke test. It is the stabilization pass before considering V2 ready.

---

## 1. Previous phase dependency

Before starting, inspect all previous V2 phase reports if they exist.

Expected locations:

- v2/reports/phase-v2-01_REPORT.md
- v2/reports/phase-v2-02_REPORT.md
- v2/reports/phase-v2-03_REPORT.md
- v2/reports/phase-v2-04_REPORT.md
- v2/reports/phase-v2-05_REPORT.md

Also inspect previous phase specs if needed:

- v2/Phase-v2-01_SPEC.md
- v2/Phase-v2-02_SPEC.md
- v2/Phase-v2-03_SPEC.md
- v2/Phase-v2-04_SPEC.md
- v2/Phase-v2-05_SPEC.md

Use these reports to understand:

- current outputStatus implementation
- current Discord notification behavior
- current refresh/cadence behavior
- current popover UI behavior
- current packaging/no-terminal flow
- known limitations from previous phases
- commands that passed or failed previously
- unverified behavior that still needs confirmation

Do not redo previous phases wholesale.

Fix compatibility issues only when required for end-to-end correctness.

---

## 2. Reporting requirement

Every V2 phase must create a persistent report file.

For this phase, create:

- v2/reports/phase-v2-06_REPORT.md

If the reports directory does not exist, create it.

The saved report must match the final chat report.

The report should help future work understand:

- whether V2 is ready
- what QA scenarios passed
- what bugs were found
- what fixes were applied
- what commands were run
- what remains unverified
- what should be done after V2

Do not include secrets, webhook URLs, .env contents, cookies, session data, access tokens, or private credentials.

---

## 3. Known QA issue: usage tracking mismatch

The user observed a mismatch between Mongi's tracked usage and the actual provider usage pages.

Observed from screenshots:

### Mongi menu bar

- Codex Short: 99%
- Codex Weekly: 99%
- Claude Short: 100%
- Claude Weekly: 100%

### Actual Codex usage page

- 5-hour usage limit: 99% remaining
- Weekly usage limit: 69% remaining

### Actual Claude usage page

- Current session: 67% used
- All models: 4% used
- Reset shown around 3h 55m for current session
- Weekly/daily reset text shown for all models

The exact field names may differ depending on provider UI.

The important issue is that Mongi's displayed values do not match the real provider pages.

This phase must investigate and fix the mismatch.

---

## 4. Usage accuracy investigation goals

Investigate the full usage data pipeline.

Trace data through:

1. browser/CDP extraction
2. provider page text or DOM capture
3. parser
4. normalized usage state
5. stateStore persistence
6. status-json output
7. menu bar app bridge
8. SwiftUI/App UI display
9. Discord usage percentage formatting if relevant

Find where the mismatch is introduced.

Possible causes include:

- stale state not refreshed
- status-json reading old state
- menu bar showing cached values
- parser selecting the wrong percentage
- parser confusing used percentage and remaining percentage
- parser confusing short and weekly limits
- parser confusing Codex and Claude provider shapes
- parser using old DOM/text assumptions after provider UI changed
- app showing used value where it labels remaining
- app showing remaining value where it labels used
- reset time mapped to the wrong limit
- provider page language or formatting changed
- CDP connected to the wrong tab or stale tab
- monitor run succeeds but app does not reload updated state
- refresh cadence path differs from manual monitor path
- Codex page uses remaining percentages while Claude page uses used percentages
- Claude “current session” and “all models” values being incorrectly mapped to short/weekly

---

## 5. Usage semantics rule

Normalize usage semantics clearly.

The app must distinguish:

- usedPercent
- remainingPercent
- resetAt or resetLabel
- provider
- window/type such as short/session/weekly/daily/all-models
- source text or debug-safe parse reason where practical

Do not mix “used” and “remaining.”

If a provider page displays remaining percentage, store that as remainingPercent or convert it carefully.

If a provider page displays used percentage, store that as usedPercent and derive remainingPercent if appropriate.

The UI label must match the value.

Examples:

- If UI says “99% remaining,” the value must be remainingPercent.
- If UI says “67% used,” the value must be usedPercent.
- If menu bar summary only shows “Short: 99%,” the UI or docs must make clear whether this means remaining or used.

For V2, prefer showing remaining percentage in the menu bar and usage bars, because the user asked for remaining bars.

---

## 6. Provider-specific interpretation

### Codex

The screenshot shows Codex usage in Korean.

Observed concepts:

- 5-hour usage limit
- weekly usage limit
- remaining percentage
- reset/init time

Codex parser should map:

- 5-hour limit to short window
- weekly limit to weekly window
- visible remaining percentage to remainingPercent
- reset/init text to reset information if available

If only remaining percentage is available, derive usedPercent as needed.

### Claude

The screenshot shows Claude usage in Korean.

Observed concepts:

- current session
- weekly limit or all models
- used percentage
- reset timing

Claude parser should not blindly reuse Codex semantics.

Claude values may be shown as used percentage rather than remaining percentage.

If Claude page shows used percentage, map that to usedPercent and derive remainingPercent.

If the app wants to show remaining, calculate remainingPercent carefully.

Do not assume provider pages use the same wording or same percentage semantics.

---

## 7. Required QA fixtures or snapshots

Add debug-safe parser fixtures or tests where practical.

Do not store screenshots as required test dependencies.

Instead, create text fixtures or parser unit tests based on the visible non-secret usage text.

Test cases should cover:

### Codex fixture

Expected values from observed page:

- short remaining approximately 99
- weekly remaining approximately 69

### Claude fixture

Expected values from observed page:

- current session used approximately 67
- all models used approximately 4
- derived remaining approximately 33 for current session
- derived remaining approximately 96 for all models, if that mapping is appropriate

If exact provider terminology differs in actual DOM text, use the current extractor output as source of truth and update tests accordingly.

Do not include cookies, session tokens, account IDs, or private page data in fixtures.

---

## 8. Required debugging output

Add or improve safe debug output for usage parsing.

The debug output should help compare:

- raw extracted text summary
- matched provider
- matched usage windows
- parsed usedPercent
- parsed remainingPercent
- reset label/time if available
- final normalized value sent to UI

Do not dump full sensitive page content.

Do not print cookies or tokens.

If raw text is needed, save only minimal redacted snippets or test fixtures.

---

## 9. Full V2 QA goals

Verify the full V2 behavior.

The expected V2 behavior is:

- Mongi launches as a menu bar app
- normal use does not require TUI
- output status is one of NO_OUTPUT, LOCAL_ONLY, SHIPPED
- quiet hours is a modifier, not core status
- Discord messages are short and based on outputStatus
- refresh cadence supports manual, 5m, 10m, 15m
- background refresh does not spam Discord
- popover shows output status and usage clearly
- usage values match provider pages within expected tolerance
- packaging/run scripts work or limitations are clear
- README reflects the actual V2 flow

---

## 10. Usage accuracy acceptance criteria

Usage tracking is acceptable when:

1. Codex short remaining in Mongi matches the actual Codex 5-hour remaining percentage.
2. Codex weekly remaining in Mongi matches the actual Codex weekly remaining percentage.
3. Claude short/session value is mapped consistently with the actual Claude page.
4. Claude weekly/all-models value is mapped consistently with the actual Claude page.
5. UI labels match value semantics.
6. status-json and menu bar UI agree.
7. manual refresh updates values.
8. popover-open refresh updates values if Phase-v2-03 implemented that behavior.
9. stale cache is identifiable through last refreshed time.
10. parser tests or fixtures cover the mismatch cases.

Tolerance:

- exact integer match is preferred when the page shows integer percentages.
- small differences due to refresh timing are acceptable if explained.
- large differences like 99% vs 69% are not acceptable.

---

## 11. End-to-end scenarios to verify

Verify these scenarios where practical:

### 11.1 Output status

- NO_OUTPUT scenario
- LOCAL_ONLY scenario
- SHIPPED scenario
- current real repo state

If full Git scenario setup is too heavy, rely on existing tests and report limitation.

### 11.2 Discord

- start notification if implemented
- NO_OUTPUT message
- LOCAL_ONLY message
- SHIPPED message
- 3-line maximum
- no complex nextAction text
- quiet hours suppression/marking
- no secrets printed

Real Discord delivery is optional if dry-run/mocked path is available.

Do not expose webhook URL.

### 11.3 Refresh

- manual refresh
- popover-open refresh if testable
- background refresh/cadence model
- manual mode disables background refresh
- background refresh does not send Discord by default

### 11.4 Usage

- Codex short usage
- Codex weekly usage
- Claude short/session usage
- Claude weekly/all-models usage
- reset countdown
- remaining/used label correctness
- status-json and UI consistency

### 11.5 Packaging

- compile-and-run script
- package script
- no-terminal normal flow
- TUI not required for normal app use

### 11.6 Documentation

- README reflects V2 behavior
- previous phase reports exist
- Phase-v2-06 report is saved

---

## 12. Expected files to inspect

Inspect the codebase for:

- previous V2 reports
- usage extractors
- Codex parser
- Claude parser
- provider normalization code
- status-json script
- stateStore
- monitor entrypoint
- app bridge from Node to SwiftUI
- SwiftUI usage UI
- refresh code
- Discord formatter
- package scripts
- README
- tests/scenario scripts

Likely search terms:

- codex
- claude
- usage
- remaining
- used
- weekly
- short
- session
- reset
- percent
- parser
- extract
- status:json
- stateStore
- refresh
- outputStatus
- Discord
- webhook
- cadence
- package
- compile

Actual file names may differ. Follow the repo structure.

---

## 13. Validation commands

Run relevant commands and inspect outputs.

Required commands if available:

- npm run health
- npm run status:json
- npm run monitor -- --dry-run-notifications
- npm run monitor
- npm run logs:summary
- npm run verify:local
- npm run test:state
- npm run test:scenarios
- npm run test:discord

If parser tests exist or are added, run them.

If app build/run scripts exist:

- bash -n scripts/compile-and-run-mongi.sh
- bash -n scripts/package-mongi-app.sh
- ./scripts/compile-and-run-mongi.sh
- ./scripts/package-mongi-app.sh

If Swift build/run commands exist, run the standard project command.

If a command cannot be executed due to environment limitation:

- report exact limitation
- run closest safe substitute
- do not claim full verification

If a command does not exist:

- inspect package.json and scripts directory
- choose closest available substitute
- report substitution

---

## 14. Test requirements

Add or update tests where practical.

Required test areas:

1. Codex usage parser
   - short remaining from 5-hour limit
   - weekly remaining from weekly limit
   - reset text if available

2. Claude usage parser
   - current session used percentage
   - all-models or weekly used percentage
   - derived remaining percentage if UI displays remaining

3. Usage normalization
   - usedPercent and remainingPercent are not confused
   - provider-specific semantics are explicit

4. status-json consistency
   - normalized usage appears correctly in status-json

5. UI/view-model mapping
   - menu bar values match normalized usage semantics
   - labels match values

6. Refresh consistency
   - manual refresh updates the state used by UI
   - stale state is visible through last refreshed time if available

7. V2 regression
   - outputStatus still works
   - Discord messages remain 3 lines or fewer
   - background refresh does not send Discord by default

If full browser/CDP integration tests are difficult, add parser/normalization fixtures and report integration limitation.

---

## 15. README update

Update README if actual V2 behavior or usage semantics changed.

README should clarify:

- menu bar usage values show remaining percentage unless explicitly labeled otherwise
- Codex short means 5-hour usage window
- Codex weekly means weekly usage window
- Claude short/session and weekly/all-models mapping as implemented
- refresh is needed for latest values
- last refreshed time indicates freshness
- known limitations if provider pages change

Do not write secret setup details into README.

---

## 16. Final V2 readiness criteria

V2 is ready only if:

1. Core output status works.
2. Discord messages are simplified and safe.
3. Refresh cadence works or limitations are clear.
4. Popover UI is readable.
5. Usage tracking values match provider pages or mismatch cause is clearly fixed.
6. Packaging/no-terminal flow works or remaining limitation is explicit.
7. Required commands were run.
8. Report file is saved.
9. No secrets were exposed.
10. Remaining issues are not blocking normal use.

If usage tracking is still inaccurate, V2 is not ready.

Do not mark V2 ready while the menu bar usage percentages substantially disagree with provider pages.

---

## 17. Completion report format

At the end, save the report to:

- v2/reports/phase-v2-06_REPORT.md

Then report the same content in chat.

Use exactly this format:

Phase-v2-06 Report

1. Files created/changed
- ...

2. Previous phase review
- ...

3. Usage tracking mismatch investigation
- Root cause:
- Fix applied:
- Codex result:
- Claude result:
- Remaining limitation:

4. End-to-end QA scenarios
- Output status:
- Discord:
- Refresh:
- Usage:
- Packaging:
- Documentation:

5. Tests / assertions
- ...

6. Commands run
- ...

7. Output / log summary
- ...

8. Failed / Not verified
- ...

9. Report file
- v2/reports/phase-v2-06_REPORT.md

10. V2 readiness judgment
- Ready / Not ready
- Reason:

11. Next recommended phase
- Phase-v2-07 — Post-V2 polish backlog
  or
- Phase-v2-06b — Usage tracking accuracy follow-up

---

## 18. Final judgment

This phase must be honest.

Do not treat V2 as complete if the app shows wrong usage values.

A menu bar tracker that displays inaccurate usage is worse than no tracker, because it creates false confidence.

The priority is:

1. correctness
2. clarity
3. stability
4. polish

Fix the usage mismatch before declaring V2 ready.