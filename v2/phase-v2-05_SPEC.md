# Phase-v2-05_SPEC.md

## Phase-v2-05 — Packaging and No-Terminal App Flow

## 0. Purpose

Phase-v2-05 makes Mongi V2 usable as a real menu bar app instead of a terminal-driven tool.

Previous phases established:

- Phase-v2-01: Git Output Status Core
- Phase-v2-02: Discord Notification Simplification
- Phase-v2-03: Menu Bar Refresh & Cadence
- Phase-v2-04: Usage UI Bars, Reset Countdown, and Cards

Phase-v2-05 must now reduce launch friction.

The expected user flow should become:

1. user opens Mongi as an app
2. Mongi appears in the menu bar
3. user can start/refresh from the app UI
4. normal use does not require a terminal dashboard
5. packaging/build scripts exist and are verified

This phase is about app delivery and developer run flow.

It is not about changing the V2 product model.

---

## 1. Previous phase dependency

Before starting, inspect previous phase reports if they exist.

Expected locations:

- v2/reports/phase-v2-01_REPORT.md
- v2/reports/phase-v2-02_REPORT.md
- v2/reports/phase-v2-03_REPORT.md
- v2/reports/phase-v2-04_REPORT.md

Also inspect previous phase specs if needed:

- v2/Phase-v2-01_SPEC.md
- v2/Phase-v2-02_SPEC.md
- v2/Phase-v2-03_SPEC.md
- v2/Phase-v2-04_SPEC.md

Use these reports to understand:

- current outputStatus shape
- current Discord notification behavior
- current refresh/cadence behavior
- current popover UI behavior
- known build/runtime limitations
- current SwiftUI/menu bar app structure
- current Node script dependencies

Do not redo previous phases unless a small compatibility fix is required for Phase-v2-05.

---

## 2. Reporting requirement

Every V2 phase must create a persistent report file.

For this phase, create:

- v2/reports/phase-v2-05_REPORT.md

If the reports directory does not exist, create it.

The saved report must match the final chat report.

The report should help Phase-v2-06 understand:

- how the app is built
- how the app is run
- whether terminal/TUI is still required
- what packaging scripts exist
- what commands were run
- what was verified
- what remains unverified

Do not include secrets, webhook URLs, .env contents, cookies, session data, or access tokens in the report.

---

## 3. Current problem

Mongi may still feel like a developer script instead of an app.

Possible current issues:

- user needs to run terminal commands manually
- TUI/dashboard may still be part of the normal flow
- app launch flow may be unclear
- build/run scripts may be missing or inconsistent
- packaging script may not exist
- app may not compile from a single documented command
- README may still describe old terminal-first workflow
- app startup may not clearly connect to the menu bar UI
- local automation and app packaging may be mixed together

V2 needs a cleaner no-terminal app flow.

---

## 4. Core goal

Implement and verify the packaging and app run flow.

Required outcomes:

- create or update app compile/run script
- create or update packaging script
- make scripts executable
- normal user flow should not require TUI dashboard
- terminal should not be required for normal use after packaging
- README should explain the V2 app flow
- developer run flow should be documented
- packaging/run scripts should be syntax-checked and executed where possible

---

## 5. Required scripts

Create or update these scripts:

- scripts/compile-and-run-mongi.sh
- scripts/package-mongi-app.sh

If equivalent scripts already exist, update them instead of duplicating.

If the project has a different script convention, preserve the existing convention but ensure the two expected scripts exist or are clearly aliased.

---

## 6. compile-and-run script requirements

The compile-and-run script should support the developer flow.

Expected behavior:

- compile the app or relevant SwiftUI/menu bar target
- run the app if compile succeeds
- fail clearly if required tools are missing
- print concise logs
- avoid printing secrets
- avoid requiring the old TUI dashboard
- use existing project paths and build commands
- work from repo root where practical

The script should not hide build errors.

If the app cannot be launched in the current environment, the script should still compile if possible and report the launch limitation.

---

## 7. package script requirements

The package script should support creating a usable app artifact where practical.

Expected behavior:

- build the menu bar app
- place the app artifact in a predictable location
- avoid including secrets
- avoid bundling .env content unless the project explicitly requires safe runtime config
- print final artifact path
- fail clearly on missing dependencies
- not require the TUI dashboard

Possible output locations:

- dist/
- build/
- release/
- existing project artifact directory

Use the existing repo convention if present.

Do not over-engineer notarization, signing, auto-update, or installer packaging in this phase unless already present.

---

## 8. No-terminal product requirement

Normal use should not require the terminal.

The intended user flow should be:

- open packaged Mongi app
- app appears in menu bar
- popover shows V2 output status and usage
- refresh works from app
- cadence works from app
- Discord notification behavior remains controlled

The terminal may still be used for:

- development
- debugging
- tests
- packaging
- health checks

But terminal/TUI must not be the normal user-facing experience.

---

## 9. TUI handling

Do not delete useful debugging tools unnecessarily.

Allowed:

- keep TUI/dashboard for development if it exists
- keep CLI tools for debugging
- keep health/status commands
- keep monitor scripts

Required:

- normal app launch should not depend on TUI
- README should distinguish app flow from dev/debug flow
- scripts should not open the TUI as the default app experience

If the current app still depends on a TUI path, refactor the smallest necessary part to make the menu bar app independent.

---

## 10. App startup behavior

When the app starts, it should behave like a menu bar app.

Expected behavior where practical:

- menu bar item appears
- app can load last known state
- app can refresh through Phase-v2-03 behavior
- app does not open a terminal dashboard
- app does not spam Discord on launch
- app can show current V2 UI from Phase-v2-04

If app startup cannot be visually verified in the environment, compile and runtime logs must be inspected and limitation reported.

---

## 11. Interaction with Discord

Packaging/run flow must not expose Discord secrets.

Do not print webhook URLs.

Do not include .env in reports.

Do not make app launch send repeated Discord messages.

If Phase-v2-02 start notification exists, preserve it but ensure packaging/run flow does not accidentally spam it during build/test.

Use dry-run or no-notify paths where appropriate for verification.

---

## 12. Expected files to inspect

Inspect the codebase for:

- SwiftUI project files
- app entrypoint
- menu bar app files
- existing scripts directory
- package.json scripts
- README run instructions
- launchd scripts
- TUI/dashboard code
- monitor/status scripts
- previous phase reports
- build output directories
- ignored files configuration

Likely search terms:

- compile
- build
- run
- package
- app
- xcodebuild
- swift
- MenuBar
- TUI
- dashboard
- launchd
- status:json
- monitor
- dry-run
- no-notify

Actual file names may differ. Follow the repo structure.

---

## 13. Validation commands

Run relevant commands and inspect outputs.

Required commands if available or after creating scripts:

- bash -n scripts/compile-and-run-mongi.sh
- bash -n scripts/package-mongi-app.sh
- chmod +x scripts/compile-and-run-mongi.sh scripts/package-mongi-app.sh
- ./scripts/compile-and-run-mongi.sh
- ./scripts/package-mongi-app.sh
- npm run health
- npm run status:json
- npm run monitor -- --dry-run-notifications
- npm run test:state
- npm run test:scenarios
- npm run test:discord

If a command cannot be executed due to environment limitations:

- report the exact limitation
- run the closest safe substitute
- do not claim full verification

If a command does not exist:

- inspect package.json and scripts directory
- choose the closest available substitute
- report the substitution

---

## 14. Test requirements

Add or update tests/checks where practical.

Cover:

1. script syntax
   - compile-and-run script passes shell syntax check
   - package script passes shell syntax check

2. script permissions
   - scripts are executable

3. no-terminal default
   - normal app run path does not launch TUI/dashboard by default

4. packaging output
   - package script creates or identifies an app artifact

5. no secret leakage
   - scripts do not echo .env or webhook values

6. compatibility
   - health/status/monitor tests still pass

If full app packaging cannot be verified in the environment, report what was not verified and why.

---

## 15. README update

Update README briefly to describe the V2 app flow.

README should include:

- how to run Mongi as a menu bar app
- how to compile and run during development
- how to package the app
- normal users do not need TUI
- CLI/TUI commands are for debugging if they remain
- Discord secrets should remain in local config and not be shared
- V2 core behavior summary:
  - output status is primary
  - usage is secondary
  - refresh cadence is app-controlled

Do not rewrite the whole README unless necessary.

---

## 16. Success criteria

Phase-v2-05 is complete when:

1. scripts/compile-and-run-mongi.sh exists or is updated.
2. scripts/package-mongi-app.sh exists or is updated.
3. Both scripts pass shell syntax check.
4. Both scripts are executable.
5. compile-and-run script is executed or limitation is clearly reported.
6. package script is executed or limitation is clearly reported.
7. Normal app flow does not require the TUI dashboard.
8. README documents the V2 app run/package flow.
9. Health/status/monitor checks still pass or failures are clearly reported.
10. v2/reports/phase-v2-05_REPORT.md is created.
11. The final chat report matches the saved report.
12. No secrets are printed.

---

## 17. Completion report format

At the end, save the report to:

- v2/reports/phase-v2-05_REPORT.md

Then report the same content in chat.

Use exactly this format:

Phase-v2-05 Report

1. Files created/changed
- ...

2. Scripts added/updated
- compile-and-run:
- package:

3. No-terminal app flow
- ...

4. TUI handling
- ...

5. Packaging result
- ...

6. README update
- ...

7. Tests / checks
- ...

8. Commands run
- ...

9. Output / log summary
- ...

10. Failed / Not verified
- ...

11. Report file
- v2/reports/phase-v2-05_REPORT.md

12. Next recommended phase
- Phase-v2-06 — End-to-End QA Pass

---

## 18. Final judgment

This phase should reduce product friction.

Mongi should no longer feel like something the user operates from a terminal.

The target is:

Open app.
See menu bar.
Refresh/check status.
Ship today.

Developer scripts can remain, but they are not the product.