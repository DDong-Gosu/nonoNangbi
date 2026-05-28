# V3 Phase A Report — Runtime Hardening

## 1. Files created / changed

### Created (JS runtime foundation)
- `src/runtime/paths.js` — single path resolver. Exposes `appSupportDir`, `logsDir`,
  `statePath`, `configPath`, `runtimePath`, `commandsPath`, `monitorLogPath`,
  `errorLogPath`, `healthLogPath`, and `ensureRuntimeDirs()`. Supports `MONGI_HOME`
  (and `MONGI_LOGS_DIR`) overrides for test isolation.
- `src/runtime/configFile.js` — `config.json` loader with `DEFAULT_CONFIG`; never
  crashes when the file is missing or invalid (returns defaults).
- `src/runtime/runtimeMeta.js` — `runtime.json` reader/writer with
  `recordMonitorStart()` / `recordMonitorHeartbeat()` (pid, startedAt, lastHeartbeatAt).

### Changed (JS)
- `src/config.js` — `stateFilePath` now resolves via `paths`; empty/relative
  `STATE_FILE_PATH` (incl. legacy `data/state.json`) is migrated into `appSupportDir`;
  absolute override still honored.
- `src/utils/logger.js` — mirrors console output to `monitor.log` (and errors to
  `error.log`); file-write failure disables file logging and reports to stderr (no crash).
- `src/monitor.js` — bootstrap calls `ensureRuntimeDirs()` + `recordMonitorStart()`;
  successful run writes `recordMonitorHeartbeat()`.
- `scripts/daily-summary.js` — state path from `loadConfig().stateFilePath` (was hardcoded `data/state.json`).
- `scripts/health-check.js` — reads resolved absolute state path; prints state path;
  appends a one-line summary to `health.log`.
- `scripts/status-json.js`, `scripts/value-review.js` — use `config.stateFilePath` directly.
- `scripts/debug-page-text.js` — debug artifacts now written to `logsDir`, not cwd `./logs`.

### Changed (Swift)
- `macos/Mongi/Mongi/Services/MongiRuntimePaths.swift` — new; FileManager-based
  standard paths (Application Support / Logs) mirroring `paths.js`, plus
  `ensureRuntimeDirectories()` (best-effort, logs failures to stderr + error.log).
- `macos/Mongi/Mongi/MongiApp.swift` — `init()` calls `MongiRuntimePaths.ensureRuntimeDirectories()` at launch.

### Changed (config/docs)
- `.env` / `.env.example` — `STATE_FILE_PATH` emptied; documented standard-path policy.
- `README.md` — new "Runtime paths (V3)" section + TOC entry; stale `data/state.json`
  / `logs/` bullets updated.

## 2. Runtime path policy

| Purpose | Location |
| --- | --- |
| State | `~/Library/Application Support/Mongi/state.json` |
| Config | `~/Library/Application Support/Mongi/config.json` |
| Runtime metadata | `~/Library/Application Support/Mongi/runtime.json` |
| Commands | `~/Library/Application Support/Mongi/commands.json` |
| Monitor log | `~/Library/Logs/Mongi/monitor.log` |
| Error log | `~/Library/Logs/Mongi/error.log` |
| Health log | `~/Library/Logs/Mongi/health.log` |

- No dependence on `process.cwd()` or project root for runtime data.
- Same paths from Xcode, Terminal, project-external execution, and packaged `.app`.
- Directories auto-created at monitor/app start.
- `MONGI_HOME` overrides the data dir (tests isolate into a temp dir); production
  default remains the macOS standard location.

## 3. JS path resolver summary

`src/runtime/paths.js` is the only place that knows physical locations. `appSupportDir`
defaults to `~/Library/Application Support/Mongi`; `logsDir` to `~/Library/Logs/Mongi`.
With `MONGI_HOME` set, both relocate under it (logs → `<MONGI_HOME>/logs`).
`ensureRuntimeDirs()` does recursive `mkdirSync` and throws on failure so callers can
log the reason. config, logger, monitor, runtimeMeta, and all state-reading scripts
consume this module.

## 4. Swift path update summary

The Swift menu bar app obtains usage state by shelling out to `npm run status:json` /
`npm run monitor` (project root locates the JS code), so it transitively reads the
unified state once JS resolves to Application Support. Additionally,
`MongiRuntimePaths` computes the identical standard paths via
`FileManager.urls(for: .applicationSupportDirectory, ...)`, and the app ensures the
runtime directories exist on launch. No new dev-only/project-root hardcoded *runtime*
paths were introduced; `mongiProjectRoot` remains only as the location of the JS code
(packaging is a later phase).

## 5. Commands run

- `npm run test:state` — pass (state at standard path)
- `npm run test:state` from `/tmp` — pass (no stray files in cwd)
- `npm run test:scenarios` — pass (`ok: true`, exit 0)
- `npm run health` — exit 0 (prints resolved state path, writes health.log)
- `npm run status:json` — exit 0, valid JSON
- `npm run monitor -- --dry-run-notifications` — completed; both providers parsed ok; heartbeat updated
- `swift build` — Build complete
- `swift test` — 9 tests, 0 failures
- `MONGI_HOME=<tmp> node scripts/test-state.js` — pass (isolated to temp dir)
- grep audit for `process.cwd()` / `./state` / `data/state.json` / `PROJECT_ROOT, stateFilePath`

## 6. Verification results

- 5.1 Path creation: `state.json`, `runtime.json`, `monitor.log`, `health.log` created
  under the standard locations; `error.log` created on first error / by Swift bootstrap.
- 5.2 Project-external execution: running from `/tmp` wrote state to Application Support
  and created no `data/` or `state.json` in cwd.
- 5.3 Xcode/Swift: package builds and tests pass; Swift computes the same Application
  Support path and ensures dirs at launch; state read path goes through `status:json`
  which resolves to the standard location. (GUI launch itself is manual — see §9.)
- 5.4 Existing commands: `test:state`, `test:scenarios`, `health`, `status:json`,
  `monitor` all pass.
- 5.5 grep: no runtime state/log/config access bypasses the resolver. Remaining
  `process.cwd()` uses are git-output detection (`gitOutputStatus`, `test-discord`,
  `notify-start`, `monitor`) and display-only relative formatting (`policy-check`),
  none of which are runtime data paths.
- 5 (README): runtime path policy documented.

## 7. Issues found

- Local `.env` set `STATE_FILE_PATH=data/state.json` (relative), which would have
  overridden the new default and pinned state to cwd.
- `scripts/daily-summary.js` hardcoded `data/state.json`, ignoring config.
- `scripts/debug-page-text.js` wrote debug files to cwd-relative `./logs`.
- macOS lacks GNU `timeout`, so the first monitor invocation exited 127 (tooling, not app).

## 8. Fixes applied

- `config.js` migrates empty/relative `STATE_FILE_PATH` into `appSupportDir`; `.env` /
  `.env.example` cleared and documented.
- `daily-summary.js` now uses `loadConfig().stateFilePath`.
- `debug-page-text.js` writes to `logsDir`.
- Re-ran monitor without `timeout` (background + sleep); confirmed success and heartbeat.

## 9. Remaining risks

- Xcode GUI launch was not exercised here (no GUI session); only `swift build` /
  `swift test` and the underlying `status:json` data path were verified. Manual check:
  run the app from Xcode and confirm the menu bar shows usage and that
  `~/Library/Application Support/Mongi/state.json` matches.
- `policy.json` still loads from project `config/policy.json` (bundled default resource,
  not user runtime state) — intentional for Phase A; revisit during packaging.
- launchd scripts still reference project `logs/launchd-*.log` — out of Phase A scope
  (launchd work explicitly excluded).
- `config.json` loader exists but is not yet wired into monitor behavior — groundwork
  for later phases (intentional).

## 10. Next phase readiness

Runtime paths are unified behind one resolver, JS + Swift agree on locations, execution
is cwd-independent, and `runtime.json` heartbeat groundwork is in place. This satisfies
the Phase A success criteria and prepares for V3 Phase B (`specs/v3/v3-phase-b-spec.md`)
and later background-stability / packaging work.

## Manual verification steps

1. From the project root: `npm run monitor -- --dry-run-notifications`, then confirm
   `~/Library/Application Support/Mongi/state.json` and `runtime.json` update and
   `~/Library/Logs/Mongi/monitor.log` grows.
2. From any other directory (e.g. `cd /tmp`): `node <project>/scripts/test-state.js` and
   confirm state still writes to Application Support, nothing to the cwd.
3. Open the app in Xcode and confirm the menu bar UI shows usage consistent with the
   state written by the monitor.
4. `npm run health` — confirm "state path" points at Application Support and `health.log` appends.
