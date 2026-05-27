Phase-v2-05 Report

1. Files created/changed
- `scripts/compile-and-run-mongi.sh`
- `scripts/package-mongi-app.sh`
- `scripts/build-mongi-app.sh`
- `scripts/open-mongi-app.sh`
- `package.json`
- `README.md`
- `.gitignore`
- `v2/reports/phase-v2-05_REPORT.md`
- `dist/Debug/Mongi.app` and `dist/Release/Mongi.app` were generated for verification and are ignored by Git.
- Existing dirty worktree files from earlier V2 phases remain present and were not reverted.

2. Scripts added/updated
- compile-and-run: `scripts/compile-and-run-mongi.sh` builds a Debug `.app` through the package script, opens it with macOS `open`, and fails clearly when required tools or artifacts are missing.
- package: `scripts/package-mongi-app.sh` builds the Swift menu bar app, creates `dist/{Debug,Release}/Mongi.app`, writes a valid `Info.plist`, copies the executable into `Contents/MacOS`, and ad-hoc signs the bundle when `codesign` is available.

3. No-terminal app flow
- Normal packaged flow is now `npm run package:app` then `npm run open:app`.
- Development flow is `npm run compile:app`.
- `npm run open:app` now prefers packaged app artifacts before Xcode DerivedData and no longer falls back to running the raw Swift executable directly.
- The packaged app launched as a process from `dist/Debug/Mongi.app` and `dist/Release/Mongi.app`; those test-launched `dist/` processes were stopped after verification.

4. TUI handling
- No TUI/dashboard runtime dependency was found in the active app/scripts path.
- Packaging, compile/run, and open scripts do not launch a TUI or terminal dashboard.
- CLI commands remain available for development, debugging, and validation only.

5. Packaging result
- Release artifact created at `dist/Release/Mongi.app`.
- Debug artifact created at `dist/Debug/Mongi.app`.
- `Info.plist` passed `plutil -lint`.
- Both Debug and Release app bundles passed `codesign --verify --deep --strict`.
- `.gitignore` now ignores `dist/` so generated app artifacts are not committed.

6. README update
- README now documents V2 as menu-bar-app-first.
- README now includes `npm run package:app`, `npm run open:app`, and `npm run compile:app`.
- README states that normal users do not need a TUI or terminal dashboard, and that CLI commands are for development/debugging.

7. Tests / checks
- Shell syntax checks passed for `compile-and-run`, `package`, `build`, and `open` scripts.
- Required scripts are executable.
- Swift package tests passed with 7 tests.
- `status:json`, health, state, scenarios, dry-run monitor, Discord smoke test, build alias, package alias, and open alias were executed.
- Secret scan on app scripts/package scripts found no webhook URL printing; only the README placeholder reference to `DISCORD_WEBHOOK_URL` remains.

8. Commands run
- `chmod +x scripts/compile-and-run-mongi.sh scripts/package-mongi-app.sh scripts/build-mongi-app.sh scripts/open-mongi-app.sh`
- `bash -n scripts/compile-and-run-mongi.sh && bash -n scripts/package-mongi-app.sh && bash -n scripts/build-mongi-app.sh && bash -n scripts/open-mongi-app.sh`
- `./scripts/package-mongi-app.sh`
- `find dist/Release/Mongi.app -maxdepth 3 -type f -print | sort && plutil -lint dist/Release/Mongi.app/Contents/Info.plist && codesign --verify --deep --strict dist/Release/Mongi.app`
- `./scripts/compile-and-run-mongi.sh`
- `find dist/Debug/Mongi.app -maxdepth 3 -type f -print | sort && plutil -lint dist/Debug/Mongi.app/Contents/Info.plist && codesign --verify --deep --strict dist/Debug/Mongi.app`
- `npm run package:app`
- `swift test --package-path macos/Mongi`
- `npm run status:json > /tmp/mongi-status-v2-05.json && node -e ...`
- `npm run health`
- `npm run test:state`
- `npm run test:scenarios`
- `npm run monitor -- --dry-run-notifications`
- `npm run test:discord`
- `npm run build:app`
- `npm run open:app`
- `pgrep -fl "dist/.*/Mongi.app/Contents/MacOS/Mongi|/Mongi$" || true`
- `pkill -f '/Users/shadowmoon/nonoNangbi/nonoNangbi/dist/.*/Mongi.app/Contents/MacOS/Mongi' || true`
- `rg -n "cat .*\\.env|printenv|DISCORD_WEBHOOK_URL|discord(?:app)?\\.com/api/webhooks" scripts/compile-and-run-mongi.sh scripts/package-mongi-app.sh scripts/build-mongi-app.sh scripts/open-mongi-app.sh package.json README.md .gitignore`
- `rg -n "TUI|dashboard|terminal" scripts package.json README.md macos/Mongi/Mongi v2/phase-v2-05_SPEC.md`
- `git status --short --ignored dist`

9. Output / log summary
- `./scripts/package-mongi-app.sh` built the Release app and printed `Artifact: /Users/shadowmoon/nonoNangbi/nonoNangbi/dist/Release/Mongi.app`.
- `./scripts/compile-and-run-mongi.sh` built the Debug app and opened `dist/Debug/Mongi.app`.
- `npm run open:app` opened `dist/Release/Mongi.app`.
- Process check confirmed packaged app processes for both Debug and Release before cleanup.
- `status:json` reported `overallStatus: ok`, `outputStatus: LOCAL_ONLY`, `cdpReachable: true`, and `launchdLoaded: true`.
- `npm run health` reported CDP reachable, launchd loaded, output status `LOCAL_ONLY`, and recent launchd notifications sent 0.
- `npm run monitor -- --dry-run-notifications` parsed Codex 99/99 and Claude 100/100, found no events, and sent 0 notifications.
- `npm run test:scenarios` passed all listed scenarios.
- `npm run test:state` passed.
- `npm run test:discord` sent the Discord smoke test message successfully.

10. Failed / Not verified
- Visual menu bar interaction was not verified through UI automation; verification used build output, app bundle checks, `open`, and process inspection.
- The generated `.app` is ad-hoc signed and not notarized, which is intentionally out of scope for this phase.
- Existing unrelated dirty worktree items remain present, including earlier phase files and user/Xcode metadata.

11. Report file
- v2/reports/phase-v2-05_REPORT.md

12. Next recommended phase
- Phase-v2-06 — End-to-End QA Pass
