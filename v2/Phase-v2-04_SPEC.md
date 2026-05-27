# Phase-v2-04_SPEC.md

## Phase-v2-04 — Usage UI Bars, Reset Countdown, and Cards

## 0. Purpose

Phase-v2-04 improves the Mongi V2 menu bar popover UI.

Phase-v2-01 established Git Output Status Core.

Phase-v2-02 simplified Discord notifications.

Phase-v2-03 implemented or improved refresh and cadence behavior.

Phase-v2-04 must now make the popover easier to read.

The UI should clearly show:

- output status
- short usage remaining
- weekly usage remaining
- reset countdown
- refresh cadence
- last refreshed time if available
- Codex/Claude usage as compact cards or equivalent sections

The primary signal remains Git output status.

AI usage is secondary information.

This phase is about UI clarity, not new monitoring architecture.

---

## 1. Previous phase dependency

Before starting, inspect previous phase reports if they exist.

Expected locations:

- v2/reports/phase-v2-01_REPORT.md
- v2/reports/phase-v2-02_REPORT.md
- v2/reports/phase-v2-03_REPORT.md

Also inspect previous phase specs if needed:

- v2/Phase-v2-01_SPEC.md
- v2/Phase-v2-02_SPEC.md
- v2/Phase-v2-03_SPEC.md

Use these reports to understand:

- current outputStatus shape
- where usage data is exposed
- how Discord notifications are separated from refresh
- current refresh cadence model
- current app state shape
- known UI/runtime limitations from Phase-v2-03

Do not redo previous phases unless a small compatibility fix is required for Phase-v2-04.

---

## 2. Reporting requirement

Every V2 phase must create a persistent report file.

For this phase, create:

- v2/reports/phase-v2-04_REPORT.md

If the reports directory does not exist, create it.

The saved report must match the final chat report.

The report should help future phases understand:

- what UI fields were added
- where usage percentages are read from
- how reset countdown is calculated or displayed
- how Codex/Claude are represented
- what commands were run
- what UI behavior was verified
- what remains unverified

Do not include secrets, webhook URLs, .env contents, cookies, session data, or access tokens in the report.

---

## 3. Current problem

The menu bar popover may still feel like a dashboard or debug surface.

Likely issues:

- output status may not be visually prominent
- usage data may be hard to scan
- short/weekly remaining information may not be shown as bars
- reset countdown may be missing or unclear
- refresh cadence may not be visible enough
- Codex/Claude information may be mixed together
- stale/unknown data states may not be clear
- UI may expose too much technical detail

V2 needs a compact, readable menu bar UI.

The user should understand the state within a few seconds.

---

## 4. Core goal

Improve the menu bar popover UI so that it clearly shows:

1. Git output status
2. short usage remaining bar
3. weekly usage remaining bar
4. reset countdown
5. refresh cadence
6. last refreshed time if available
7. Codex/Claude usage in cards or compact sections

The UI should emphasize:

Did you ship today?

Usage data should support that, not dominate it.

---

## 5. Product hierarchy

The popover information hierarchy should be:

1. Output status
2. Immediate action meaning
3. Usage remaining
4. Reset timing
5. Refresh/cadence metadata
6. Provider details

Output status must be more prominent than usage.

Usage should not look like the primary product score.

Avoid turning the popover into a large analytics dashboard.

---

## 6. Output status UI

Display the V2 output status prominently.

Allowed statuses:

- NO_OUTPUT
- LOCAL_ONLY
- SHIPPED

The status should be readable without opening logs.

The UI should include a short meaning line.

Recommended meanings:

- NO_OUTPUT: No shipped or local Git output detected.
- LOCAL_ONLY: Local work exists. Ship it today.
- SHIPPED: Git output detected today.

Do not use guilt language.

Do not display “you did nothing.”

If status details are available, keep them compact.

Examples of useful compact details:

- local changes
- unpushed commits
- shipped today
- branch

Do not show raw debug dumps in the UI.

---

## 7. Usage bar requirements

Add or improve usage bars for:

- short usage
- weekly usage

The user requested short/weekly remaining bars.

Therefore bars should represent remaining amount where practical.

If the underlying data is stored as used percentage, convert display wording clearly.

Acceptable display patterns:

- Short remaining: 37%
- Weekly remaining: 59%
- Short used: 63%, remaining 37%
- Weekly used: 41%, remaining 59%

Be consistent.

If exact percentage is available, show exact percentage.

If usage data is missing, show a graceful unavailable state rather than breaking the UI.

---

## 8. Reset countdown requirements

Display reset countdown if the data is available.

Expected behavior:

- show time remaining until short reset if available
- show time remaining until weekly reset if available
- if only one reset time exists, show that one clearly
- if reset time is unavailable, show a compact unknown/unavailable state

The countdown should be human-readable.

Examples of acceptable wording:

- Reset in 2h 14m
- Short reset: 2h 14m
- Weekly reset: 3d 4h
- Reset: unavailable

Do not over-engineer exact live ticking if the app does not currently support it.

If countdown only updates on refresh, that is acceptable for this phase.

Report whether countdown is live or refresh-based.

---

## 9. Refresh cadence display

Phase-v2-03 should have introduced cadence behavior.

Phase-v2-04 should make cadence visible in the UI if not already visible enough.

Display:

- current cadence
- last refreshed time if available
- refresh status if practical

Examples:

- Cadence: 5m
- Last refreshed: 19:42
- Refreshing...
- Manual mode

Do not implement new cadence architecture in this phase unless required for display compatibility.

---

## 10. Codex/Claude layout

Improve Codex/Claude display as cards or compact sections.

Prefer cards or stacked sections over tabs unless the existing UI strongly favors tabs.

Reason:

- menu bar popovers are small
- cards reduce click cost
- the user can compare providers quickly

Each provider section should show only useful data.

Possible fields:

- provider name
- short usage
- weekly usage
- reset countdown
- parse status
- last checked time

Do not show raw parsed page text.

Do not show long logs.

Do not add complex filters or sorting.

---

## 11. Empty, loading, and error states

Handle UI states gracefully.

Required states where practical:

- loading / refreshing
- data unavailable
- parse failed
- provider not configured
- last known data available
- Git status unavailable

The UI should not crash or become blank because one provider failed.

Provider-level failure should not hide output status.

Git output status failure should not hide usage data.

---

## 12. Visual design constraints

Keep the UI compact and app-like.

Do:

- use readable labels
- group related information
- make output status prominent
- show exact percentages
- keep provider sections compact
- avoid clutter

Do not:

- create a large dashboard
- add charts
- add complex analytics
- add unnecessary tabs if cards work
- add long paragraphs
- add motivational essays
- add raw debug JSON

This phase is about clarity, not decoration.

---

## 13. Interaction with refresh

The UI should work with Phase-v2-03 refresh behavior.

Expected behavior:

- manual refresh updates displayed usage/status
- popover-open refresh updates displayed usage/status
- background refresh updates displayed usage/status
- last refreshed time updates when refresh succeeds
- refresh failure is visible or logged safely

Do not change Discord notification behavior unless a small fix is required to keep refresh quiet.

---

## 14. Expected files to inspect

Inspect the codebase for:

- SwiftUI app files
- popover view
- provider usage view
- app state model
- status model
- usage parser output shape
- status-json output shape
- cadence setting
- last refreshed state
- reset time data
- README UI description
- previous phase reports

Likely search terms:

- Popover
- ContentView
- MenuBar
- Usage
- Codex
- Claude
- reset
- countdown
- percentage
- remaining
- outputStatus
- cadence
- lastRefresh
- refreshedAt
- status:json

Actual file names may differ. Follow the repo structure.

---

## 15. Validation commands

Run relevant commands and inspect outputs.

Required commands if available:

- npm run health
- npm run status:json
- npm run monitor -- --dry-run-notifications
- npm run test:state
- npm run test:scenarios
- npm run test:discord

If Swift build/run scripts exist, run the relevant one.

Possible commands:

- npm run app:build
- npm run app:run
- npm run build
- ./scripts/compile-and-run-mongi.sh
- xcodebuild with the project’s existing arguments

Also run syntax/type checks for changed files where available.

If a command does not exist:

- inspect package.json and scripts directory
- choose the closest available substitute
- report the substitution

If UI cannot be visually inspected in the current environment:

- report that clearly
- still verify compile/runtime logs
- verify status-json data mapping where possible

---

## 16. Test requirements

Add or update tests where practical.

Cover:

1. Usage percentage mapping
   - used percentage to remaining percentage if needed
   - exact percentage display

2. Missing usage data
   - UI/state formatter handles unavailable provider data

3. Reset countdown formatting
   - hours/minutes
   - days/hours
   - unavailable reset time

4. Output status display mapping
   - NO_OUTPUT
   - LOCAL_ONLY
   - SHIPPED

5. Cadence display
   - manual
   - 5m
   - 10m
   - 15m

6. Provider cards/sections
   - Codex section
   - Claude section
   - one provider missing does not break the other

If full UI tests are difficult, add formatter/view-model tests and report what was not integration-tested.

---

## 17. README update

If README lacks V2 UI behavior, update it briefly.

README should mention:

- output status is primary
- usage is secondary
- short/weekly remaining bars are shown
- reset countdown is shown when available
- refresh cadence is visible
- Codex/Claude are shown as compact provider sections or cards

Do not do a full README rewrite.

---

## 18. Success criteria

Phase-v2-04 is complete when:

1. Output status is prominent in the popover or app UI.
2. Short remaining bar is shown or represented clearly.
3. Weekly remaining bar is shown or represented clearly.
4. Exact usage percentages are visible when available.
5. Reset countdown is shown when available.
6. Current refresh cadence is visible.
7. Codex/Claude are shown as compact cards or sections.
8. Missing provider data is handled gracefully.
9. Refresh behavior from Phase-v2-03 still works.
10. Background refresh still does not spam Discord.
11. Relevant commands were run and inspected.
12. v2/reports/phase-v2-04_REPORT.md is created.
13. The final chat report matches the saved report.
14. No secrets are printed.

---

## 19. Completion report format

At the end, save the report to:

- v2/reports/phase-v2-04_REPORT.md

Then report the same content in chat.

Use exactly this format:

Phase-v2-04 Report

1. Files created/changed
- ...

2. UI structure implemented
- Output status:
- Usage bars:
- Reset countdown:
- Provider cards/sections:
- Cadence/refresh metadata:

3. Usage data handling
- Short:
- Weekly:
- Missing data:

4. Reset countdown handling
- ...

5. Refresh integration
- ...

6. Tests / assertions
- ...

7. Commands run
- ...

8. Output / log summary
- ...

9. Failed / Not verified
- ...

10. Report file
- v2/reports/phase-v2-04_REPORT.md

11. Next recommended phase
- Phase-v2-05 — Packaging and No-Terminal App Flow

---

## 20. Final judgment

This phase should make the popover immediately understandable.

The user should be able to open Mongi and quickly answer:

- Did I ship today?
- How much usage remains?
- When does usage reset?
- Is the data fresh?

Do not build a dashboard.

Build a compact menu bar status surface.