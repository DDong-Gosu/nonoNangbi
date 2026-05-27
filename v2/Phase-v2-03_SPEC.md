# Phase-v2-03_SPEC.md

## Phase-v2-03 — Menu Bar Refresh & Cadence

## 0. Purpose

Phase-v2-03 improves Mongi V2's menu bar refresh behavior.

Phase-v2-01 established the Git Output Status Core.

Phase-v2-02 simplified Discord notifications around the V2 output status model.

Phase-v2-03 must now make the menu bar app feel reliable and controllable.

The user should be able to:

- open the popover and see fresh state
- choose refresh cadence
- keep Mongi running without Discord spam
- understand when the app last refreshed
- understand the current refresh mode

This phase is about refresh behavior and cadence control, not visual redesign.

---

## 1. Previous phase dependency

Before starting, inspect previous phase reports if they exist.

Expected locations:

- v2/reports/phase-v2-01_REPORT.md
- v2/reports/phase-v2-02_REPORT.md

Also inspect previous phase specs if needed:

- v2/Phase-v2-01_SPEC.md
- v2/Phase-v2-02_SPEC.md

Use these reports to understand:

- the current outputStatus shape
- where status data is exposed
- how Discord notification formatting now works
- whether start notification was fully wired or only partially verified
- known limitations from previous phases

Do not redo Phase-v2-01 or Phase-v2-02 unless a small compatibility fix is required for Phase-v2-03.

---

## 2. Reporting requirement

Every V2 phase must create a persistent report file.

For this phase, create:

- v2/reports/phase-v2-03_REPORT.md

If the reports directory does not exist, create it.

The saved report must match the final chat report.

The report should help future phases understand:

- what refresh behavior was implemented
- what cadence options exist
- where settings are stored
- what commands were run
- what was visually or runtime verified
- what remains unverified

Do not include secrets, webhook URLs, .env contents, cookies, session data, or access tokens in the report.

---

## 3. Current problem

The menu bar app needs more predictable refresh behavior.

Current likely issues:

- popover may show stale data when opened
- refresh may require manual command execution
- background refresh may not exist or may be unclear
- refresh cadence may not be user-configurable
- app may not show current cadence
- refresh and notification may be coupled too tightly
- background checks may risk Discord spam
- user may not know when state was last updated

For V2, Mongi should feel like a small always-available menu bar coach.

---

## 4. Core goal

Implement refresh behavior for the menu bar app.

Required behavior:

- popover open triggers one refresh
- app can refresh quietly in the background
- refresh cadence can be configured
- supported cadence values are:
  - manual
  - 5m
  - 10m
  - 15m
- current cadence is visible somewhere in the app/UI/status
- cadence setting persists across app restarts if practical
- background refresh must not spam Discord

---

## 5. Product rule

Refresh and notification must be separate concepts.

Refresh means:

- read current state
- update app state
- update status display
- update last refreshed time
- update usage/output data if available

Notification means:

- decide whether a Discord message should be sent
- format Discord message
- send Discord message only if policy allows

A background refresh must not automatically mean a Discord notification.

If the existing monitor command always sends notifications, introduce or reuse a dry-run, quiet, or no-notify mode for app refresh.

Do not break manual notification behavior from previous phases.

---

## 6. Refresh cadence model

Supported cadence values:

- manual
- 5m
- 10m
- 15m

Expected behavior:

### manual

- no automatic background refresh timer
- user can still manually refresh
- popover open may still refresh once if this is consistent with product behavior

### 5m

- background refresh runs about every 5 minutes while app is active

### 10m

- background refresh runs about every 10 minutes while app is active

### 15m

- background refresh runs about every 15 minutes while app is active

The exact timer implementation depends on the current app architecture.

If the menu bar app is SwiftUI, use the simplest reliable timer approach already consistent with the app.

If the app delegates refresh to Node scripts, avoid spawning noisy or overlapping processes.

---

## 7. Popover open refresh

When the user opens the menu bar popover, Mongi should run one refresh.

Expected behavior:

- refresh starts when popover appears
- UI should not freeze unnecessarily
- if refresh succeeds, state updates
- if refresh fails, last known state remains available if practical
- error is visible or logged without dumping secrets
- repeated rapid popover opens should not cause overlapping refresh storms

If the current architecture makes popover-open detection hard, implement the closest available equivalent and report the limitation.

---

## 8. Manual refresh

Manual refresh should remain available or be added if missing.

Expected behavior:

- user can trigger refresh from menu/popover/app UI
- manual refresh updates state
- manual refresh should not necessarily send Discord notification
- if there is a separate “notify/test Discord” action, keep it separate

If the current app has only a command-line refresh, connect it to the menu bar app if practical.

---

## 9. Background refresh

When cadence is 5m, 10m, or 15m, Mongi should refresh quietly while the app is running.

Expected behavior:

- refresh timer starts when app starts or when cadence is set
- timer interval changes when cadence changes
- manual mode disables background timer
- app avoids overlapping refresh runs
- background refresh does not spam Discord
- refresh errors are logged safely

This phase does not require launchd changes unless the app currently depends on launchd for all refresh behavior.

Do not rewrite the entire automation system in this phase.

---

## 10. Cadence setting persistence

Persist cadence setting if practical.

Preferred behavior:

- cadence survives app restart
- default cadence is 5m unless existing product config says otherwise
- user can change cadence from the menu bar UI

Possible storage:

- existing config/state file
- UserDefaults if SwiftUI app uses it
- existing app settings mechanism

Do not introduce a large new settings system if the app already has one.

If persistence is not practical in this phase, implement runtime selection and report persistence as not verified.

---

## 11. UI requirements

This phase is not a full UI redesign.

Minimum UI/status requirements:

- show current outputStatus if already available
- show current refresh cadence
- show last refreshed time if practical
- expose cadence selection:
  - manual
  - 5m
  - 10m
  - 15m
- expose manual refresh action if practical

Do not spend this phase on:

- short/weekly usage bars
- reset countdown visual design
- Codex/Claude card redesign
- major layout redesign

Those belong to Phase-v2-04.

---

## 12. Interaction with Discord

Background refresh must not spam Discord.

The app should use one of these approaches:

- refresh via status-json or equivalent read-only state command
- run monitor in dry-run/no-notify mode
- call a state refresh function without notification dispatch
- add a safe app refresh path that does not send Discord

If existing code cannot separate refresh from notification cleanly, make the smallest safe refactor needed.

Do not remove Discord notification functionality from Phase-v2-02.

---

## 13. Expected files to inspect

Inspect the codebase for:

- SwiftUI app files
- menu bar app entrypoint
- popover view
- refresh button/action
- app state model
- Node bridge scripts
- status-json script
- monitor command
- notification dispatcher
- Discord dry-run/no-notify support
- config/state storage
- package.json scripts
- previous phase reports

Likely search terms:

- MenuBar
- popover
- statusItem
- refresh
- cadence
- timer
- UserDefaults
- status:json
- monitor
- dry-run
- notification
- no-notify
- outputStatus

Actual file names may differ. Follow the repo structure.

---

## 14. Validation commands

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

Do not invent heavyweight build commands if the repo already has a standard script.

If a command does not exist:

- inspect package.json and scripts directory
- choose the closest available substitute
- report the substitution

If UI cannot be visually inspected in the current environment:

- report that clearly
- still verify compile/runtime logs
- verify state/cadence behavior through logs or status output where possible

---

## 15. Test requirements

Add or update tests where practical.

Cover:

1. Cadence value validation
   - manual
   - 5m
   - 10m
   - 15m
   - invalid value rejected or defaulted safely

2. Manual mode
   - no background timer or equivalent automatic refresh scheduling

3. Timer mode
   - interval is set correctly for 5m, 10m, 15m

4. Popover refresh
   - popover open triggers refresh once if testable

5. No notification spam
   - background/app refresh path does not send Discord by default

6. Persistence
   - cadence value persists if storage is implemented

If these are difficult to test directly due to SwiftUI/app lifecycle, add logic-level tests for the cadence model and report what was not integration-tested.

---

## 16. README update

If README currently lacks V2 refresh behavior, update it briefly.

README should mention:

- popover open refreshes state
- supported refresh cadence values
- background refresh is quiet
- Discord notifications are not sent on every refresh
- manual mode is available if implemented

Do not do a full README rewrite.

---

## 17. Success criteria

Phase-v2-03 is complete when:

1. Popover open triggers one refresh or closest available equivalent is implemented and reported.
2. Manual refresh exists or existing manual refresh is preserved.
3. Refresh cadence supports manual, 5m, 10m, and 15m.
4. Current cadence is visible or exposed through app/status.
5. Cadence persistence is implemented or limitation is clearly reported.
6. Background refresh does not automatically send Discord notifications.
7. Refresh and notification are separated enough for future phases.
8. Tests or logic checks cover cadence behavior where practical.
9. Relevant commands were run and inspected.
10. v2/reports/phase-v2-03_REPORT.md is created.
11. The final chat report matches the saved report.
12. No secrets are printed.

---

## 18. Completion report format

At the end, save the report to:

- v2/reports/phase-v2-03_REPORT.md

Then report the same content in chat.

Use exactly this format:

Phase-v2-03 Report

1. Files created/changed
- ...

2. Refresh behavior implemented
- Popover open:
- Manual refresh:
- Background refresh:

3. Cadence model
- Supported values:
- Default:
- Persistence:
- UI/status exposure:

4. Notification separation
- ...

5. Tests / assertions
- ...

6. Commands run
- ...

7. Output / log summary
- ...

8. Failed / Not verified
- ...

9. Report file
- v2/reports/phase-v2-03_REPORT.md

10. Next recommended phase
- Phase-v2-04 — Usage UI Bars, Reset Countdown, and Cards

---

## 19. Final judgment

This phase should make Mongi feel less like a script and more like a living menu bar app.

The user should not need to wonder:

Is the data stale?

The app should refresh clearly, quietly, and predictably.