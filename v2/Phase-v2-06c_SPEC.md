# Phase-v2-06c_SPEC.md

## Phase-v2-06c — QA Hotfix: Menu Bar Usage Gauges and Source-Level Usage Accuracy Audit

## 0. Purpose

Phase-v2-06c is a follow-up QA hotfix after Phase-v2-06b.

Phase-v2-06b improved Korean labels and restored usage visibility, but actual user QA still shows two blocking issues:

1. Menu bar usage visibility is still poor.
2. Usage tracking is still not trustworthy.

This phase must fix both.

The menu bar should make Codex and Claude usage visible at a glance, preferably with compact gauge/progress bars.

The usage tracking pipeline must be audited at source-code level, not only by fixture tests.

Do not mark V2 ready if usage values remain inaccurate or visually unclear.

---

## 1. Previous phase dependency

Before starting, inspect previous V2 reports.

Expected locations:

- v2/reports/phase-v2-01_REPORT.md
- v2/reports/phase-v2-02_REPORT.md
- v2/reports/phase-v2-03_REPORT.md
- v2/reports/phase-v2-04_REPORT.md
- v2/reports/phase-v2-05_REPORT.md
- v2/reports/phase-v2-06_REPORT.md
- v2/reports/phase-v2-06b_REPORT.md

Also inspect previous specs if needed:

- v2/Phase-v2-01_SPEC.md
- v2/Phase-v2-02_SPEC.md
- v2/Phase-v2-03_SPEC.md
- v2/Phase-v2-04_SPEC.md
- v2/Phase-v2-05_SPEC.md
- v2/Phase-v2-06_SPEC.md
- v2/Phase-v2-06b_SPEC.md

Do not assume previous readiness judgments are correct.

Actual user screenshots and live command output are the source of truth.

---

## 2. Reporting requirement

Create a persistent report file:

- v2/reports/phase-v2-06c_REPORT.md

The saved report must match the final chat report.

Do not include secrets, webhook URLs, .env contents, cookies, session data, access tokens, or private credentials.

---

## 3. User-observed issues

### 3.1 Menu bar usage visibility is still weak

Current menu bar shows:

- Korean output status
- short meaning line
- Codex 남음 99% / 69%
- Claude 남음 100% / 100%
- 새로고침 time and cadence
- branch/local tags

This is better than before, but still not visually strong.

The older UI made Codex and Claude usage more immediately visible because each provider had clear Short/Weekly values.

The new UI compresses too much into text.

Required improvement:

- show Codex and Claude usage with compact visual gauges/bars
- make short/session and weekly/all-models values readable at a glance
- keep the popover compact
- do not force the user to open Full App to understand usage

---

### 3.2 Usage tracking still feels wrong

The user still reports that usage tracking is not working correctly.

Previous reports claimed the issue was fixed, but the user does not trust the result.

This phase must perform a source-level usage accuracy audit.

Do not only adjust UI.

Trace the exact data flow:

1. extracted browser text
2. parser output
3. normalized provider usage state
4. persisted state
5. status-json output
6. Swift model decode
7. menu bar UI
8. full app UI
9. Discord message usage line

The phase must identify where mismatch can occur and fix it.

---

## 4. Source files to inspect

Inspect these files if they exist:

- src/parsers/codexParser.js
- src/parsers/claudeParser.js
- src/parsers/common.js
- src/state/stateStore.js
- src/state/serviceStateUpdater.js
- src/monitor.js
- scripts/status-json.js
- scripts/debug-page-text.js
- scripts/test-scenarios.js
- src/notifications/messages.js
- macos/Mongi/Mongi/Models/MongiStatus.swift
- macos/Mongi/Mongi/MongiAppViewModel.swift
- macos/Mongi/Mongi/Views/MenuBarStatusView.swift
- macos/Mongi/Mongi/Views/UsageCardView.swift
- macos/Mongi/MongiCore/StatusDisplayFormatter.swift
- macos/Mongi/MongiCoreTests/StatusDisplayFormatterTests.swift

Also inspect package scripts and previous reports.

---

## 5. Required evidence to collect

Run and inspect these outputs where available:

- npm run status:json
- npm run debug:codex
- npm run debug:claude
- npm run monitor -- --dry-run-notifications
- npm run health

Compare them against actual provider usage pages if accessible.

If actual provider pages are not accessible, say so clearly.

Do not mark usage accuracy as fully verified based only on fixtures.

---

## 6. Usage accuracy audit requirements

For each provider, produce a clear mapping table in the report.

### Codex

Identify and verify:

- source page label for short window
- source page percentage
- whether source percentage means remaining or used
- parser field
- normalized field
- status-json field
- Swift model field
- menu bar displayed value
- full app displayed value
- Discord displayed value

Expected conceptual mapping:

- Codex 5-hour usage limit maps to short
- Codex weekly usage limit maps to weekly
- Codex page appears to show remaining percentage
- menu bar should display remaining percentage

### Claude

Identify and verify:

- source page label for current/session window
- source page percentage
- source page label for all-models/weekly window
- source page percentage
- whether source percentage means used or remaining
- parser field
- normalized field
- status-json field
- Swift model field
- menu bar displayed value
- full app displayed value
- Discord displayed value

Claude must not blindly reuse Codex semantics.

If Claude source shows used percentage and UI says remaining, remaining must be derived correctly.

---

## 7. Menu bar UI requirements

Implement compact usage gauges in the menu bar popover.

Required visible elements:

1. Korean output status label
2. short status meaning line
3. Codex usage gauge row
4. Claude usage gauge row
5. last refreshed time
6. cadence
7. action buttons

The usage gauge row should be compact.

Possible layout:

- Codex
  - 5시간 99%
  - 주간 69%
  - two small bars or one stacked compact display

- Claude
  - 세션 33%
  - 전체 96%
  - two small bars or one stacked compact display

The exact design can differ.

But each provider must visually expose two values without relying only on dense text.

The user should be able to glance at the popover and understand usage.

---

## 8. Gauge semantics

The gauge should represent remaining percentage unless the UI label explicitly says used.

Preferred V2 menu bar display:

- remaining percentage

If remaining is displayed:

- higher bar means more remaining
- lower bar means closer to limit
- label should say 남음 or equivalent

Do not show a used percentage in a remaining gauge.

If a value is unknown:

- show 확인 안 됨
- show an empty/neutral bar if needed
- do not default to 100 unless the source actually indicates 100 remaining

This is important.

A missing Claude value must not silently become 100%.

---

## 9. Missing/unknown usage rule

Do not treat missing data as 100%.

This is a likely source of false confidence.

If parser cannot find a provider percentage:

- remainingPercent should be null or unavailable
- usedPercent should be null or unavailable
- UI should show 확인 안 됨
- Discord should omit the provider value or show 확인 안 됨
- health/status-json should expose parse confidence or unavailable reason

Only show 100% remaining when the source explicitly supports it.

---

## 10. Parser confidence rule

If parser confidence exists, use it.

If it does not exist, add lightweight confidence/reason fields where practical.

The report should say:

- parsed with high confidence
- parsed with low confidence
- unavailable
- stale
- fallback

The UI does not need to show all debug info, but status-json/debug commands should make it inspectable.

---

## 11. Staleness rule

The menu bar must make stale data identifiable.

Show last refreshed time.

If usage data was not refreshed recently, show it clearly if the project has a freshness threshold.

Do not make stale values look fresh.

If freshness threshold is not implemented, at least preserve and display lastCheckedAt.

---

## 12. Discord usage line requirements

Discord should use the same normalized display values as the menu bar.

Do not duplicate usage formatting logic in a way that can diverge.

Required:

- Korean-first
- no raw enum as primary label
- no cryptic S/W unless explained
- use remaining values
- unknown values should not become 100

Example style:

- Codex 99/69 남음 · Claude 33/96 남음
- Codex 99/69 남음 · Claude 확인 안 됨

---

## 13. Tests required

Add or update tests for:

1. Missing usage does not become 100
2. Codex 99/69 remaining maps correctly through parser/normalization/status-json formatter
3. Claude used values convert to remaining correctly
4. Claude missing/low-confidence parse shows unavailable instead of 100
5. Menu bar formatter includes provider usage rows
6. Gauge model uses remaining percentage
7. Korean display labels remain correct
8. Discord usage line uses the same normalized values
9. status-json preserves usedPercent, remainingPercent, confidence, and lastCheckedAt
10. Refresh path does not send Discord

If Swift UI visual tests are difficult, add view-model or formatter tests.

---

## 14. Required commands

Run relevant commands and inspect outputs.

Required commands if available:

- npm run test:scenarios
- npm run test:state
- npm run test:discord
- npm run status:json
- npm run debug:codex
- npm run debug:claude
- npm run monitor -- --dry-run-notifications
- npm run monitor
- npm run health
- swift test --package-path macos/Mongi
- npm run build:app
- npm run package:app
- ./scripts/compile-and-run-mongi.sh

Also run syntax checks for changed JavaScript files.

If a command cannot be executed:

- report why
- run the closest safe substitute
- do not claim full verification

---

## 15. README update

Update README if behavior changes.

README should clarify:

- menu bar shows compact usage gauges
- values are remaining percentages unless labeled otherwise
- missing provider usage is shown as unavailable, not 100
- last refreshed time indicates freshness
- Codex and Claude may have different source semantics
- Discord uses the same normalized usage values as the menu bar

Do not include secrets.

---

## 16. Success criteria

Phase-v2-06c is complete when:

1. Menu bar popover shows compact usage gauges or equivalent high-visibility usage rows.
2. Codex and Claude are visible at a glance.
3. Missing usage does not default to 100.
4. Usage semantics are explicit across parser, state, status-json, Swift model, menu UI, and Discord.
5. Codex mapping is verified.
6. Claude mapping is verified or unavailable state is honestly shown.
7. status-json and menu bar agree.
8. Discord uses the same normalized usage values.
9. Tests pass.
10. Report file is saved.
11. V2 readiness is judged honestly.

If usage remains inaccurate or hidden, V2 is not ready.

---

## 17. Completion report format

At the end, save the report to:

- v2/reports/phase-v2-06c_REPORT.md

Then report the same content in chat.

Use exactly this format:

Phase-v2-06c Report

1. Files created/changed
- ...

2. QA issues reviewed
- Menu bar gauge visibility:
- Usage accuracy:
- Missing value handling:
- Discord consistency:

3. Source-level usage audit
- Codex:
- Claude:
- Parser:
- State:
- status-json:
- Swift model:
- Menu bar:
- Discord:

4. Fixes applied
- Menu bar:
- Parser/normalization:
- status-json:
- Swift/UI:
- Discord:
- Tests:

5. Usage verification
- Codex:
- Claude:
- Missing/unknown behavior:
- Remaining limitation:

6. Commands run
- ...

7. Output / log summary
- ...

8. Failed / Not verified
- ...

9. Report file
- v2/reports/phase-v2-06c_REPORT.md

10. V2 readiness judgment
- Ready / Not ready
- Reason:

11. Next recommended phase
- Phase-v2-07 — Post-V2 polish backlog
  or
- Phase-v2-06d — Usage tracking live-source fix

---

## 18. Final judgment

This phase must not optimize for “tests pass.”

It must optimize for user trust.

A usage tracker that silently turns unknown into 100% is dangerous.

A menu bar tracker that hides usage behind text is weak.

The correct result is:

- visible usage
- honest unknown states
- clear Korean labels
- consistent values across the whole pipeline