Phase-v2-04 Report

1. Files created/changed
- `macos/Mongi/Mongi/Views/MenuBarStatusView.swift`
- `macos/Mongi/Mongi/Views/UsageCardView.swift`
- `macos/Mongi/Mongi/Views/UsageMeterView.swift`
- `macos/Mongi/Mongi/Models/MongiStatus.swift`
- `macos/Mongi/MongiCore/StatusDisplayFormatter.swift`
- `macos/Mongi/MongiCoreTests/StatusDisplayFormatterTests.swift`
- `scripts/status-json.js`
- `README.md`
- `v2/reports/phase-v2-04_REPORT.md`
- Existing Phase-v2-03 files remain changed in the worktree: `macos/Mongi/Package.swift`, `macos/Mongi/MongiAppViewModel.swift`, `macos/Mongi/ContentView.swift`, `macos/Mongi/MongiCore/RefreshCadence.swift`, `macos/Mongi/MongiCoreTests/RefreshCadenceTests.swift`.
- SwiftPM/Xcode user metadata remains changed from build/test activity.

2. UI structure implemented
- Output status: menu bar popover now puts `NO_OUTPUT`, `LOCAL_ONLY`, or `SHIPPED` at the top with a short meaning line and compact branch/local/unpushed/shipped chips.
- Usage bars: Codex and Claude sections now show `Short remaining` and `Weekly remaining` bars with exact percentages.
- Reset countdown: each provider section shows short and weekly reset text. Current data has no reset timestamp, so the UI shows `unavailable`.
- Provider cards/sections: Codex and Claude are separate compact sections, each with remaining bars, reset state, parse failure count when present, and last checked time.
- Cadence/refresh metadata: popover keeps the Phase-v2-03 cadence picker and shows `refreshing` or `cadence {value}` plus last refreshed time in the summary row.

3. Usage data handling
- Short: reads `usage.{provider}.shortRemaining` from `status:json`, clamps display to 0-100%, and shows the exact value beside the bar.
- Weekly: reads `usage.{provider}.weeklyRemaining` from `status:json`, clamps display to 0-100%, and shows the exact value beside the bar.
- Missing data: formatter returns `unavailable`, progress falls back to 0, and one missing provider does not hide the other provider or the output status.

4. Reset countdown handling
- `status:json` now exposes optional `shortResetAt` and `weeklyResetAt` fields for each provider.
- Swift model decodes those optional fields.
- `StatusDisplayFormatter.resetCountdown` formats minutes, hours/minutes, and days/hours when timestamps are present.
- Current parser/state does not produce reset timestamps, so countdown is refresh-based and currently displays `unavailable`.

5. Refresh integration
- Popover still refreshes on open through the Phase-v2-03 `onAppear` path.
- Manual/background refresh still use `npm run status:json`, so UI refresh remains separate from Discord notification dispatch.
- Dry-run monitor and real monitor both completed with `notificationsSent: 0`.

6. Tests / assertions
- Added Swift formatter tests for output status meaning, percentage text/progress, reset countdown formatting, unavailable reset time, and cadence labels.
- Existing cadence tests still pass.
- Swift package tests passed with 7 tests.
- Node syntax check for `status-json`, `monitor`, and scenario tests passed.
- Existing scenario tests passed.
- State smoke test passed.

7. Commands run
- `swift test --package-path macos/Mongi` initially failed on Swift 6 concurrency checks for shared `ISO8601DateFormatter`; fixed by removing static formatter instances.
- `swift test --package-path macos/Mongi`
- `node -c scripts/status-json.js`
- `npm run status:json > /tmp/mongi-status-v2-04.json && node -e ...`
- `node -c scripts/status-json.js && node -c src/monitor.js && node -c scripts/test-scenarios.js`
- `npm run test:scenarios`
- `npm run test:state`
- `npm run health`
- `npm run monitor -- --dry-run-notifications`
- `npm run build:app`
- `npm run test:discord`
- `npm run monitor`
- `npm run open:app`
- `ps -p 64709 -o pid=,comm= || true`
- `rg "discord(?:app)?\\.com/api/webhooks|DISCORD_WEBHOOK_URL\\s*=" -g '!node_modules' -g '!package-lock.json'`
- `git diff --stat`

8. Output / log summary
- Final `swift test` built `Mongi`, `MongiCore`, and tests successfully; 7 tests passed.
- `status:json` returned `overallStatus: ok`, `outputStatus: LOCAL_ONLY`, Codex 99/99, Claude 100/100, and reset fields as `null`.
- `npm run health` reported CDP reachable, launchd loaded, output status `LOCAL_ONLY`, and recent launchd notifications sent 0.
- `npm run monitor -- --dry-run-notifications` parsed Codex 99/99 and Claude 100/100, found no events, and sent 0 notifications.
- `npm run monitor` completed with no events and `notificationsSent: 0`.
- `npm run build:app` succeeded.
- `npm run test:discord` sent the Discord smoke test message successfully.
- `npm run open:app` used the Swift executable fallback because no Xcode `.app` bundle was present; the process was no longer running when checked by `ps`.
- Secret scan found placeholders/redaction patterns only, not a concrete webhook URL.

9. Failed / Not verified
- Actual menu bar popover rendering was not visually verified because no Xcode-built `.app` bundle was available and the Swift executable fallback exited quickly.
- Reset countdown with live production data was not verified because current parser/state does not expose reset timestamps.
- Countdown updates only when status refreshes; live ticking was intentionally not implemented in this phase.
- Existing unrelated dirty worktree items remain present and were not reverted.

10. Report file
- v2/reports/phase-v2-04_REPORT.md

11. Next recommended phase
- Phase-v2-05 — Packaging and No-Terminal App Flow
