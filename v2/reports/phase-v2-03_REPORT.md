Phase-v2-03 Report

1. Files created/changed
- `macos/Mongi/Package.swift`
- `macos/Mongi/MongiCore/RefreshCadence.swift`
- `macos/Mongi/MongiCoreTests/RefreshCadenceTests.swift`
- `macos/Mongi/Mongi/MongiAppViewModel.swift`
- `macos/Mongi/Mongi/ContentView.swift`
- `macos/Mongi/Mongi/Views/MenuBarStatusView.swift`
- `macos/Mongi/Mongi/Models/MongiStatus.swift`
- `README.md`
- `v2/reports/phase-v2-03_REPORT.md`
- `macos/Mongi/.swiftpm/xcode/package.xcworkspace/xcuserdata/shadowmoon.xcuserdatad/UserInterfaceState.xcuserstate` changed during SwiftPM/Xcode build metadata update.
- `macos/Mongi/.swiftpm/xcode/xcuserdata/shadowmoon.xcuserdatad/xcschemes/xcschememanagement.plist` changed during SwiftPM/Xcode build metadata update.

2. Refresh behavior implemented
- Popover open: `MenuBarStatusView.onAppear` triggers one quiet `refreshStatus(showOutput: false)` call. Overlapping refreshes are skipped by `refreshInFlight` and `isRunningCommand`.
- Manual refresh: existing refresh buttons remain wired to `npm run status:json`; full app manual refresh can show command output, menu bar refresh stays quiet.
- Background refresh: `MongiAppViewModel` starts a timer task for 5m, 10m, and 15m cadence while the app is active. Manual mode cancels the background task.

3. Cadence model
- Supported values: `manual`, `5m`, `10m`, `15m`.
- Default: `5m`.
- Persistence: cadence is stored in `UserDefaults` with key `mongi.refreshCadence`; invalid or missing values safely default to `5m`.
- UI/status exposure: full app header and menu bar popover show current cadence, last refreshed time, and decoded `outputStatus`. Both views expose a segmented cadence picker.

4. Notification separation
- App refresh uses `npm run status:json`, which reads state and Git output without sending Discord notifications.
- Background refresh calls the same quiet refresh path and does not call `npm run monitor`.
- Existing monitor and Discord notification paths were preserved. `npm run monitor -- --dry-run-notifications` completed with `notificationsSent: 0`.

5. Tests / assertions
- Added Swift logic tests for cadence supported values, intervals, and invalid-value fallback.
- Swift package test passed with 3 tests.
- Existing scenario tests passed, including V2 Discord message and quiet-hours assertions.
- State persistence smoke test passed.
- Syntax checks passed for touched Node validation paths.

6. Commands run
- `node -c scripts/status-json.js && node -c src/monitor.js && node -c scripts/test-scenarios.js`
- `swift test --package-path macos/Mongi`
- `npm run test:scenarios`
- `npm run test:state`
- `npm run status:json > /tmp/mongi-status-v2-03.json && node -e ...`
- `npm run health`
- `npm run monitor -- --dry-run-notifications`
- `npm run build:app`
- `npm run test:discord`
- `npm run monitor`
- `npm run open:app`
- `ps -p 61552 -o pid=,comm= || true`
- `rg "discord(?:app)?\\.com/api/webhooks|DISCORD_WEBHOOK_URL\\s*=" -g '!node_modules' -g '!package-lock.json'`

7. Output / log summary
- `swift test` built `Mongi`, `MongiCore`, and `MongiCoreTests`; 3 cadence tests passed.
- `npm run test:scenarios` passed all listed scenarios.
- `npm run test:state` wrote and reloaded the state smoke timestamp successfully.
- `status:json` summary: `overallStatus: ok`, `outputStatus: LOCAL_ONLY`, `cdpReachable: true`, `launchdLoaded: true`.
- `npm run health` reported `.env` found, Discord configured, CDP reachable, launchd loaded, and output status `LOCAL_ONLY`.
- Dry-run monitor parsed Codex 99/99 and Claude 100/100, found no events, and sent 0 notifications.
- Real monitor completed with no events and `notificationsSent: 0`.
- `npm run build:app` succeeded.
- `npm run test:discord` sent the Discord smoke test message successfully.
- `npm run open:app` found no Xcode `.app` bundle and started the Swift build executable fallback, but the process was no longer running when checked by `ps`.
- Secret scan found only placeholders or redaction patterns, not a webhook URL.

8. Failed / Not verified
- Actual menu bar popover clicking was not visually verified because no Xcode-built `.app` bundle was available and the Swift executable fallback exited quickly.
- Background timer was compile-tested and cadence logic-tested, but real 5m/10m/15m waiting behavior was not observed end-to-end.
- SwiftPM/Xcode user metadata changed during build/test and remains in the worktree.
- Existing unrelated dirty worktree items from earlier phases remain present and were not reverted.

9. Report file
- v2/reports/phase-v2-03_REPORT.md

10. Next recommended phase
- Phase-v2-04 — Usage UI Bars, Reset Countdown, and Cards
