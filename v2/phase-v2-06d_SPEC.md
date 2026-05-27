# Phase-v2-06d_SPEC.md

## Phase-v2-06d — Live Source Binding Fix for Usage Tracking

## 0. Purpose

Phase-v2-06d fixes the remaining blocking usage tracking issue.

Previous parser and UI fixes are not enough.

User QA shows that Mongi still displays stale or incorrect usage values:

- Actual Codex page shows 85% / 51% remaining.
- Mongi menu bar shows Codex 99% / 69% remaining.
- Actual Claude page shows 50% used / 7% used.
- Mongi menu bar shows Claude 100% / 100% remaining.

This is not just a parser formatting problem.

The likely root issue is source binding:

Mongi may not be reading the same live browser tab/page/profile that the user is viewing.

This phase must prove and fix what source Mongi is actually reading.

Do not mark V2 ready until live page values, debug output, status-json, and menu bar agree.

---

## 1. Previous phase dependency

Before starting, inspect previous V2 reports:

- v2/reports/phase-v2-01_REPORT.md
- v2/reports/phase-v2-02_REPORT.md
- v2/reports/phase-v2-03_REPORT.md
- v2/reports/phase-v2-04_REPORT.md
- v2/reports/phase-v2-05_REPORT.md
- v2/reports/phase-v2-06_REPORT.md
- v2/reports/phase-v2-06b_REPORT.md
- v2/reports/phase-v2-06c_REPORT.md

Do not assume previous readiness judgments are correct.

Actual user-observed page values are the source of truth.

---

## 2. Reporting requirement

Create a persistent report file:

- v2/reports/phase-v2-06d_REPORT.md

The saved report must match the final chat report.

Do not include secrets, webhook URLs, .env contents, cookies, session data, access tokens, private account identifiers, or full raw page dumps.

---

## 3. Current observed mismatch

The user observed:

### Codex

Actual page:

- 5-hour usage limit: 85% remaining
- weekly usage limit: 51% remaining

Mongi menu bar:

- Codex 5시간: 99% remaining
- Codex 주간: 69% remaining

### Claude

Actual page:

- current session: 50% used
- all models: 7% used

Expected remaining if UI displays remaining:

- current/session remaining: 50%
- all-models remaining: 93%

Mongi menu bar:

- Claude 세션: 100% remaining
- Claude 전체: 100% remaining

This mismatch is blocking.

---

## 4. Main hypothesis

The most likely issue is not the visual gauge and not only parser scoring.

Investigate these hypotheses in order:

1. CDP is connected to a different Chrome instance than the user-visible browser.
2. CDP is using a different Chrome profile.
3. CDP is reading a stale tab.
4. CDP is selecting the wrong tab among multiple Codex/Claude tabs.
5. CDP is reading the correct tab URL but stale DOM text.
6. monitor/debug/status-json use different extraction paths.
7. app refresh reads status-json without forcing live extraction.
8. stateStore preserves previous good values and hides current parse failure.
9. missing or failed extraction becomes old values without enough UI warning.
10. parser is still misreading the current page after source binding is verified.

Do not jump directly to parser changes.

First prove whether the extractor sees the same visible values as the actual page.

---

## 5. Required source binding diagnostics

Add or improve safe diagnostics for both Codex and Claude extraction.

For each provider, debug output must include:

- provider name
- CDP endpoint used
- browser connection status
- browser/version if available
- selected tab URL
- selected tab title
- selected tab target/page id if available
- whether the page was actively navigated or reused
- extraction timestamp
- parser timestamp
- state write timestamp
- lastCheckedAt used by status-json
- minimal safe extracted text snippet around matched percentages
- all percentage tokens found with nearby non-sensitive context
- which token was selected for short/session
- which token was selected for weekly/all-models
- whether selected tokens match expected provider labels
- parse confidence
- parse failure reason if any

Do not print full raw page content.

Do not print cookies, tokens, account identifiers, or secrets.

---

## 6. Required live-source verification command

Add or update a command that verifies live source binding.

Preferred command name if no equivalent exists:

- npm run verify:usage-source

The command should:

1. connect to CDP
2. list relevant Codex/Claude candidate tabs
3. print selected tab URL/title for each provider
4. extract safe text snippets
5. print all detected percentage candidates
6. print final parsed values
7. print current state/status-json values
8. report whether extraction, state, and status-json agree

The output should make it obvious whether Mongi is reading the correct page.

If the command cannot access live provider pages, it must say so clearly.

---

## 7. Controlled tab strategy

If the current extractor searches existing tabs and often picks stale/wrong tabs, implement a more deterministic strategy.

Preferred behavior:

- use a dedicated CDP Chrome profile
- use one controlled Codex usage tab
- use one controlled Claude usage tab
- identify tabs by exact provider URL patterns
- prefer the most recently active matching tab only if safe
- if no valid tab exists, open or navigate a controlled tab
- wait for page load/network idle or a stable DOM condition
- wait until expected usage labels appear
- then extract

Avoid reading random matching tabs.

Avoid silently using stale tabs.

If navigation/opening tabs is too disruptive, make it explicit and report limitation.

---

## 8. Wrong-browser/profile detection

Detect and report when the user may be looking at a different browser/profile than CDP.

Diagnostics should show:

- CDP browser profile path if available
- CDP remote debugging port
- number of matching provider tabs
- selected tab URL/title
- last extraction time

The menu bar or health output should expose enough information to diagnose stale source.

At minimum, health/debug output must say:

- CDP connected
- selected Codex tab URL/title
- selected Claude tab URL/title
- last checked time
- parse confidence/failure

---

## 9. Stale state handling

Current behavior may preserve previous good values when parsing fails.

That is useful, but dangerous if the UI makes stale values look fresh.

Update state/status/UI behavior so stale values are obvious.

Rules:

- If live extraction fails, do not silently make old values look fresh.
- Preserve previous values only with stale marker.
- status-json should expose stale/provider failure state.
- menu bar should show stale or 확인 필요 when provider data is not freshly verified.
- health should show parse failures clearly.
- Discord should not send old usage values as if they were fresh.

If stateStore currently updates lastCheckedAt on failed parse while preserving old values, fix this or add separate fields:

- lastAttemptedAt
- lastSuccessfulCheckedAt
- lastParseFailedAt
- consecutiveParseFailures

The UI should use lastSuccessfulCheckedAt for freshness of displayed usage.

---

## 10. Usage semantics after source binding

Once source binding is verified, confirm parser semantics.

### Codex

Expected from user screenshot:

- 5-hour remaining: 85
- weekly remaining: 51

Mongi should display:

- Codex 5시간: 85% 남음
- Codex 주간: 51% 남음

### Claude

Expected from user screenshot:

- session/current used: 50
- all-models used: 7

If UI displays remaining, Mongi should display:

- Claude 세션: 50% 남음
- Claude 전체: 93% 남음

If UI displays used instead, labels must say 사용됨.

Preferred V2 menu bar display remains remaining percentage.

---

## 11. Menu bar requirements

Keep the compact gauge UI from Phase-v2-06c.

But ensure values are live and trustworthy.

Menu bar should show:

- Codex 5시간 remaining
- Codex 주간 remaining
- Claude 세션 remaining
- Claude 전체 remaining
- last successful usage check time
- stale/failure marker when appropriate

Do not show 100% remaining unless the live source actually says 0% used or 100% remaining.

---

## 12. Discord requirements

Discord usage line must use the same fresh normalized values as menu bar.

If usage source is stale or failed:

- omit usage line
- or show 확인 필요
- do not show old values as fresh
- do not show 100/100 by default

Discord should remain Korean-first and 3 logical lines or fewer.

---

## 13. Tests required

Add or update tests for:

1. source selection
   - multiple candidate tabs
   - stale tab rejected if fresher valid tab exists
   - wrong provider tab rejected

2. stale state
   - failed parse preserves previous value but marks it stale
   - lastSuccessfulCheckedAt is not overwritten by failed parse
   - UI displays stale marker

3. Codex live fixture
   - 85/51 remaining maps to menu/status-json correctly

4. Claude live fixture
   - 50 used / 7 used maps to 50/93 remaining

5. missing source
   - missing provider does not become 100
   - Discord omits stale usage or marks 확인 필요

6. status-json consistency
   - extraction result, state, and status-json agree

7. menu formatter
   - uses lastSuccessfulCheckedAt
   - shows stale marker when needed

If browser integration tests are hard, add unit tests for source selection and state freshness, plus run live debug commands manually.

---

## 14. Required commands

Run relevant commands and inspect output.

Required if available:

- npm run verify:usage-source
- npm run debug:codex
- npm run debug:claude
- npm run status:json
- npm run monitor -- --dry-run-notifications
- npm run monitor
- npm run health
- npm run test:scenarios
- npm run test:state
- npm run test:discord
- swift test --package-path macos/Mongi
- npm run build:app
- npm run package:app
- ./scripts/compile-and-run-mongi.sh

Also run syntax checks for changed JavaScript files.

If a command cannot run:

- report why
- run closest substitute
- do not claim full verification

---

## 15. User-provided evidence to compare against

Compare live outputs against the user screenshots.

Expected values from current screenshots:

- Codex 5시간: 85% 남음
- Codex 주간: 51% 남음
- Claude 세션/current: 50% 사용됨, therefore 50% 남음
- Claude 전체/all models: 7% 사용됨, therefore 93% 남음

If live CDP output does not match these values, do not assume parser is correct.

First determine whether CDP is reading the same browser/page/profile.

---

## 16. README update

Update README if behavior changes.

README should clarify:

- Mongi reads usage from the CDP-controlled Chrome source.
- The visible browser page and CDP source must match.
- Debug command can verify selected provider tabs.
- Menu bar uses last successful usage check time.
- Stale usage is marked instead of silently trusted.
- Missing values do not become 100.

Do not include secrets.

---

## 17. Success criteria

Phase-v2-06d is complete when:

1. The agent can prove which live provider tab Mongi reads.
2. Debug output shows selected URL/title and matched percentage context.
3. Codex live values match user-visible page or source mismatch is clearly identified and fixed.
4. Claude live values match user-visible page or source mismatch is clearly identified and fixed.
5. status-json agrees with extraction output.
6. menu bar agrees with status-json.
7. stale values are clearly marked.
8. missing values do not become 100.
9. Discord does not report stale usage as fresh.
10. tests and commands pass.
11. report file is saved.
12. V2 readiness is judged honestly.

If CDP is reading a different browser/profile and this is not fixed, V2 is not ready.

---

## 18. Completion report format

At the end, save the report to:

- v2/reports/phase-v2-06d_REPORT.md

Then report the same content in chat.

Use exactly this format:

Phase-v2-06d Report

1. Files created/changed
- ...

2. Root cause investigation
- Source binding:
- Stale state:
- Parser:
- UI:
- Discord:

3. Live source verification
- Codex selected source:
- Codex extracted values:
- Codex status-json/menu values:
- Claude selected source:
- Claude extracted values:
- Claude status-json/menu values:

4. Fixes applied
- CDP/tab selection:
- Debug commands:
- State freshness:
- Parser/normalization:
- Menu bar:
- Discord:
- Tests:

5. User screenshot comparison
- Codex expected 85/51:
- Claude expected 50 used / 7 used:
- Match result:
- If not matched, why:

6. Commands run
- ...

7. Output / log summary
- ...

8. Failed / Not verified
- ...

9. Report file
- v2/reports/phase-v2-06d_REPORT.md

10. V2 readiness judgment
- Ready / Not ready
- Reason:

11. Next recommended phase
- Phase-v2-07 — Post-V2 polish backlog
  or
- Phase-v2-06e — Usage source architecture change

---

## 19. Final judgment

Stop patching parser heuristics until source binding is proven.

The tracker is only correct if Mongi reads the same live page the user is looking at.

If the app reads a stale tab or a different Chrome profile, parser tests are irrelevant.

The priority is:

1. prove source
2. fix source binding
3. prevent stale values from looking fresh
4. then refine parser