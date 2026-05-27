# Phase-v2-06b_SPEC.md

## Phase-v2-06b — QA Hotfix: Usage Visibility, Korean UX, and Tracking Accuracy

## 0. Purpose

Phase-v2-06b is a QA hotfix phase after Phase-v2-06.

Phase-v2-06 reported V2 as ready, but actual user QA screenshots show remaining blocking issues.

This phase must fix the real user-facing problems before V2 can be considered ready.

Observed issues:

- menu bar popover no longer shows usage percentages clearly
- output status labels are too technical and English-heavy
- Discord messages are hard to read on mobile
- usage tracking still appears inaccurate or stale
- the app does not clearly explain what SHIPPED, LOCAL_ONLY, and NO_OUTPUT mean
- Discord notification cadence/start behavior may be noisy or confusing

This phase is not a polish phase.

This is a correctness and usability hotfix.

---

## 1. Previous phase dependency

Before starting, inspect all previous reports.

Expected locations:

- v2/reports/phase-v2-01_REPORT.md
- v2/reports/phase-v2-02_REPORT.md
- v2/reports/phase-v2-03_REPORT.md
- v2/reports/phase-v2-04_REPORT.md
- v2/reports/phase-v2-05_REPORT.md
- v2/reports/phase-v2-06_REPORT.md

Also inspect specs if needed:

- v2/Phase-v2-01_SPEC.md
- v2/Phase-v2-02_SPEC.md
- v2/Phase-v2-03_SPEC.md
- v2/Phase-v2-04_SPEC.md
- v2/Phase-v2-05_SPEC.md
- v2/Phase-v2-06_SPEC.md

Do not assume Phase-v2-06 readiness is correct.

Use the actual user QA screenshots and current app behavior as the source of truth.

---

## 2. Reporting requirement

Create a persistent report file:

- v2/reports/phase-v2-06b_REPORT.md

The saved report must match the final chat report.

The report must clearly say whether V2 is ready after this hotfix.

Do not include secrets, webhook URLs, .env contents, cookies, session data, access tokens, or private credentials.

---

## 3. User-observed QA issues

The user provided screenshots showing these problems.

### 3.1 Menu bar popover issue

The current popover shows:

- SHIPPED
- Git output detected today.
- branch main
- local changes
- shipped today
- actions such as Start Mongi, Refresh, Open Full App, Health Check, Daily Summary, Value Review, Quit Mongi

But it does not show usage percentages.

This is wrong for V2.

The menu bar popover must show the compact status and usage summary.

Minimum required visible information:

- Korean status label
- short meaning line
- Codex short remaining
- Codex weekly remaining
- Claude short/session remaining or used, with clear label
- Claude weekly/all-models remaining or used, with clear label
- last refreshed time
- cadence

The popover must remain compact.

Do not turn it into a dashboard.

---

### 3.2 Status wording issue

Current statuses are technical:

- SHIPPED
- LOCAL_ONLY
- NO_OUTPUT

These are fine internally but poor as user-facing Korean UX.

User-facing labels should be Korean and action-oriented.

Required mapping:

- SHIPPED
  - Korean label: 오늘 푸시함
  - Meaning: 오늘 GitHub에 올라간 작업이 있습니다.

- LOCAL_ONLY
  - Korean label: 로컬 작업만 있음
  - Meaning: 로컬 변경이 있습니다. 아직 푸시되지 않았습니다.

- NO_OUTPUT
  - Korean label: 산출물 없음
  - Meaning: 오늘 감지된 로컬 변경이나 푸시가 없습니다.

Internal enum values must remain:

- SHIPPED
- LOCAL_ONLY
- NO_OUTPUT

Do not rename internal status values unless absolutely necessary.

Add a display mapping layer.

---

### 3.3 Discord readability issue

Current Discord messages are too English-heavy and visually noisy.

Example problems:

- “Mongi started”
- “Watching Git output: LOCAL_ONLY”
- “Cadence: 10분마다 확인”
- “LOCAL_ONLY”
- “Git: local work 있음. 오늘 push까지 달기.”
- “Usage remaining: Codex S99%/W69%, Claude S100%/W100%”

Problems:

- mixed English/Korean
- LOCAL_ONLY is not user-friendly
- “S99%/W69%” is too cryptic
- mobile wrapping makes the message look longer than intended
- status and usage do not visually stand out enough
- start message and status message may be duplicative

Discord messages should be Korean-first and short.

Required style:

- maximum 3 logical lines
- each line should be short enough to avoid ugly mobile wrapping
- no raw enum as primary label
- include usage in readable Korean shorthand
- avoid long English phrases

Suggested format style:

Line 1: 🐇 로컬 작업만 있음
Line 2: 아직 푸시 안 됨. 오늘 하나 올리자.
Line 3: Codex 99/69 · Claude 33/96 남음

For SHIPPED:

Line 1: 🐇 오늘 푸시함
Line 2: GitHub 산출물 감지됨.
Line 3: Codex 99/69 · Claude 33/96 남음

For NO_OUTPUT:

Line 1: 🐇 산출물 없음
Line 2: 로컬 변경/푸시가 아직 없음.
Line 3: Codex 99/69 · Claude 33/96 남음

Start notification should be separate and short:

Line 1: 🐇 Mongi 시작
Line 2: 10분마다 조용히 확인
Line 3: 알림은 필요한 경우만 전송

If cadence is unavailable, omit cadence or use a short fallback.

---

### 3.4 Usage tracking accuracy issue

The user still does not trust usage tracking.

Phase-v2-06 claimed Codex was fixed and Claude was fixture-covered, but actual user QA still says values are not reliably displayed.

This phase must verify the current actual pipeline again.

Required checks:

- actual provider page value
- extracted text or safe debug snippet
- parser output
- normalized state
- status-json output
- Swift model value
- menu bar displayed value
- Discord displayed value

The agent should not stop at parser fixture tests.

Live or current extraction must be checked if CDP is available.

If live extraction is unavailable, report that clearly and do not mark V2 ready.

---

## 4. Usage visibility requirement

The popover must show usage again.

Minimum popover summary:

- Output status Korean label
- Codex: short/weekly
- Claude: short/weekly or session/all-models
- Last refreshed
- Cadence

Possible compact layout:

- 오늘 푸시함
- Codex 남음: 99% / 69%
- Claude 남음: 33% / 96%
- 새로고침: 23:57 · 주기: 10분

The exact UI can differ, but the information must be visible without opening Full App.

---

## 5. Usage semantics rule

The app must be explicit about whether values are remaining or used.

Preferred V2 display:

- show remaining percentage

For providers that expose used percentage:

- store usedPercent
- derive remainingPercent
- display remainingPercent
- optionally expose usedPercent in detail view

Do not show a value as remaining if it is used.

Do not show a value as used if it is remaining.

Do not show cryptic labels like S/W unless the UI explains them nearby.

In Korean UI, prefer:

- 5시간
- 주간
- 세션
- 전체

For compact Discord, acceptable:

- Codex 99/69 남음
- Claude 33/96 남음

But README or UI detail should clarify what the two numbers mean.

---

## 6. Menu bar UI requirements

The compact menu bar popover should show:

1. Korean output status label
2. short Korean meaning line
3. Codex usage summary
4. Claude usage summary
5. cadence
6. last refreshed time
7. action buttons

The popover should not hide usage behind “Open Full App.”

The Full App can contain detailed bars and cards, but the menu bar popover must contain the high-signal summary.

---

## 7. Full app UI requirement

The full app should continue to show detailed usage bars.

Verify that:

- Codex 5-hour remaining displays correctly
- Codex weekly remaining displays correctly
- Claude session/current remaining or used displays with correct label
- Claude all-models/weekly remaining or used displays with correct label
- reset countdown does not show false data
- unavailable reset time is shown honestly

---

## 8. Discord notification requirements

Update Discord formatter.

Requirements:

- Korean-first
- outputStatus mapped to Korean display label
- 3 logical lines or fewer
- short enough for mobile readability
- no raw LOCAL_ONLY/SHIPPED/NO_OUTPUT as primary visible text
- no mixed awkward English/Korean
- no cryptic S/W without context unless compact and understandable
- usage line included when values are available
- no usage line if values are unavailable
- no secrets printed

Also verify:

- start notification is not sent repeatedly by background refresh
- manual refresh does not spam Discord
- app launch does not spam Discord unless start action explicitly triggers it
- background cadence refresh remains quiet

---

## 9. Start notification rule

The Start Mongi action may send a start notification.

But the app must not send repeated start messages every time:

- popover opens
- background refresh runs
- app reloads status-json
- monitor dry-run executes

If start notifications are duplicated, fix the trigger logic.

Start notification should only send when the user intentionally starts Mongi or explicitly tests Discord.

---

## 10. Required debugging artifacts

Add or use safe debug commands to compare values.

Required checks where possible:

- npm run status:json
- npm run debug:codex
- npm run debug:claude
- npm run monitor -- --dry-run-notifications
- npm run health

The debug output should show:

- provider
- parsed window labels
- usedPercent
- remainingPercent
- reset label/time if available
- normalized value used by UI
- lastCheckedAt

Do not print:

- full raw private page content
- cookies
- tokens
- webhook URLs
- account identifiers

If a minimal fixture is created from user-visible screenshots, keep it generic and non-sensitive.

---

## 11. Required tests

Add or update tests for:

1. Korean status display mapping
   - SHIPPED to 오늘 푸시함
   - LOCAL_ONLY to 로컬 작업만 있음
   - NO_OUTPUT to 산출물 없음

2. Menu bar summary formatter
   - includes status label
   - includes Codex usage if available
   - includes Claude usage if available
   - includes last refreshed/cadence if available

3. Discord formatter
   - Korean-first
   - no raw enum as primary label
   - 3 logical lines or fewer
   - includes readable usage line
   - handles missing usage

4. Usage semantics
   - remaining/used are not confused
   - Codex weekly 69 does not become 99
   - Claude used 67 becomes remaining 33 if UI displays remaining
   - Claude used 4 becomes remaining 96 if UI displays remaining

5. Refresh no-spam behavior
   - background refresh does not send start notification
   - status-json/app refresh path does not send Discord

6. status-json to Swift model mapping
   - usage fields are preserved
   - usedPercent and remainingPercent are both available where expected

If Swift UI snapshot tests are not practical, add model/view-model tests and report visual verification status.

---

## 12. Required commands

Run relevant commands and inspect outputs.

Required commands if available:

- npm run test:scenarios
- npm run test:state
- npm run test:discord
- npm run status:json
- npm run monitor -- --dry-run-notifications
- npm run monitor
- npm run health
- npm run debug:codex
- npm run debug:claude
- swift test --package-path macos/Mongi
- npm run build:app
- npm run package:app
- ./scripts/compile-and-run-mongi.sh

Also run syntax checks for changed JS files.

If a command cannot be executed:

- report why
- run the closest safe substitute
- do not claim full verification

---

## 13. README update

Update README if needed.

README should clarify:

- menu bar compact view shows status and usage summary
- full app shows detailed bars
- internal statuses are mapped to Korean labels
- usage display prefers remaining percentage
- Codex mapping
- Claude mapping
- refresh is needed for latest values
- last refreshed time indicates freshness
- Discord messages are Korean-first and compact

Do not include secrets.

---

## 14. Success criteria

Phase-v2-06b is complete when:

1. Menu bar popover shows usage percentages again.
2. Output status is shown with Korean user-facing labels.
3. Discord messages are Korean-first and readable.
4. Discord messages are still 3 logical lines or fewer.
5. Usage values are visibly present in popover, full app, status-json, and Discord when available.
6. Codex short/weekly mapping is verified.
7. Claude used/remaining semantics are verified.
8. Start notification is not duplicated by refresh/background runs.
9. Background refresh does not spam Discord.
10. Tests pass.
11. Report file is saved.
12. No secrets are printed.
13. V2 readiness is judged honestly.

If usage values remain inaccurate or hidden, V2 is not ready.

---

## 15. Completion report format

At the end, save the report to:

- v2/reports/phase-v2-06b_REPORT.md

Then report the same content in chat.

Use exactly this format:

Phase-v2-06b Report

1. Files created/changed
- ...

2. QA issues reviewed
- Menu bar usage visibility:
- Korean status labels:
- Discord readability:
- Usage tracking accuracy:
- Notification spam:

3. Fixes applied
- Menu bar:
- Full app:
- Discord:
- Usage parser/normalization:
- Refresh/no-spam:

4. Usage verification
- Codex:
- Claude:
- status-json:
- Swift/UI:
- Remaining limitation:

5. Tests / assertions
- ...

6. Commands run
- ...

7. Output / log summary
- ...

8. Failed / Not verified
- ...

9. Report file
- v2/reports/phase-v2-06b_REPORT.md

10. V2 readiness judgment
- Ready / Not ready
- Reason:

11. Next recommended phase
- Phase-v2-07 — Post-V2 polish backlog
  or
- Phase-v2-06c — Usage tracking live verification follow-up

---

## 16. Final judgment

Phase-v2-06b must judge the product by actual user experience, not by internal test pass count.

If the user opens the menu bar and cannot see usage, the UI failed.

If Discord is technically short but visually unreadable, the notification failed.

If usage values do not match the provider pages, the tracker failed.

Fix these before calling V2 ready.