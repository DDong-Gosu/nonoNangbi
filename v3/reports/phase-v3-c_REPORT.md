# V3 Phase C Report — App Packaging & Xcode 탈출

## 목차

- Files created/changed
- Packaging strategy
- App bundle resource structure
- Monitor runner summary
- Node resolution strategy
- Logging strategy
- Lifecycle handling
- Commands run
- Verification results
- Issues found
- Fixes applied
- Remaining risks
- Next phase readiness

## Files created/changed

Created:

- `macos/Mongi/Mongi/MongiAppDelegate.swift`
- `macos/Mongi/Mongi/Services/MonitorBundleResolver.swift`
- `macos/Mongi/Mongi/Services/MonitorRunner.swift`
- `macos/Mongi/Mongi/Services/NodeResolver.swift`
- `scripts/build-monitor-dist.sh`
- `v3/reports/phase-v3-c_REPORT.md`

Changed:

- `macos/Mongi/Mongi/MongiApp.swift`
- `macos/Mongi/Mongi/MongiAppViewModel.swift`
- `macos/Mongi/Mongi/ContentView.swift`
- `macos/Mongi/Mongi/Services/MongiStatusService.swift`
- `macos/Mongi/Mongi/Services/ShellRunner.swift`
- `macos/Mongi/Mongi/Views/MenuBarStatusView.swift`
- `scripts/package-mongi-app.sh`
- `package.json`
- `src/monitor.js`
- `README.md`

## Packaging strategy

Local release는 `npm run release:local`로 생성한다.

현재 `release:local`은 `npm run package:app`을 실행한다. `package:app`은 내부에서 monitor dist를 먼저 만들고, Swift release build 후 `dist/Release/Mongi.app`을 만든다.

Bundled node는 구현하지 않았다. 이번 Phase는 시스템 node 기반 local release다.

## App bundle resource structure

생성된 release app:

- `dist/Release/Mongi.app`

주요 구조:

- `Contents/MacOS/Mongi`
- `Contents/Resources/monitor/src/monitor.js`
- `Contents/Resources/monitor/scripts`
- `Contents/Resources/monitor/config`
- `Contents/Resources/monitor/node_modules`
- `Contents/Resources/monitor/package.json`
- `Contents/Resources/monitor/package-lock.json`
- `Contents/Resources/monitor/runtime-manifest.json`

`dist/monitor`를 만든 뒤 app bundle의 `Resources/monitor`로 복사한다.

## Monitor runner summary

Swift app에 `MonitorRunner`를 추가했다.

역할:

- app 시작 시 monitor 자동 실행
- packaged monitor path 우선 사용
- dev fallback path 지원
- node 탐색 및 `node --version` 검증
- stdout/stderr 로그 연결
- runtime 상태 기록
- 종료 감지
- 앱 종료 시 직접 시작한 child process 정리

Monitor path 우선순위:

1. `Bundle.main.resourceURL/monitor/src/monitor.js`
2. 선택된 dev project root의 `src/monitor.js`

## Node resolution strategy

탐색 순서:

1. `/opt/homebrew/bin/node`
2. `/usr/local/bin/node`
3. `/usr/bin/node`
4. `/usr/bin/env node`

각 후보는 실행 전 `node --version`으로 검증한다.

검증용 override:

- `MONGI_NODE_CANDIDATES`

이 값으로 node not found 경로를 실제 검증했다. Production 기본 동작에는 영향이 없다.

## Logging strategy

표준 로그 경로:

- stdout: `~/Library/Logs/Mongi/monitor.log`
- stderr: `~/Library/Logs/Mongi/error.log`

초기 구현에서는 Process output을 log file handle에 직접 연결했지만, JS logger와 file offset이 충돌할 수 있어 Pipe로 받은 뒤 append하는 방식으로 수정했다.

MonitorRunner 자체 이벤트도 `monitor.log` 또는 `error.log`에 남긴다.

## Lifecycle handling

`MongiAppDelegate`에서 앱 종료 시 `MonitorRunner.stop()`을 호출한다.

정책:

- 앱이 직접 시작한 child process만 종료한다.
- 이미 종료된 one-shot monitor는 `runtime.json`에 `status = stopped`, `pid = null`로 남긴다.
- node not found 또는 monitor start failure는 `status = failed`, `lastError`로 기록한다.

## Commands run

- `bash -n scripts/build-monitor-dist.sh` — pass
- `bash -n scripts/package-mongi-app.sh` — pass
- `node -c src/monitor.js` — pass
- `node -c scripts/status-json.js` — pass
- `node -c scripts/health-check.js` — pass
- `node -c src/runtime/runtimeMeta.js` — pass
- `npm run build:monitor` — pass
- `npm run package:app` — pass
- `npm run release:local` — pass
- `swift build` — pass
- `swift test` — pass, 9 tests
- `npm run test:scenarios` — pass
- `npm run test:state` — pass
- `npm run health` — pass
- `npm run status:json` — pass
- `npm run check:cdp` — pass
- `npm run monitor -- --dry-run-notifications` — pass
- `git diff --check` — pass

## Verification results

Release app:

- `dist/Release/Mongi.app` 생성 확인.
- app bundle 내부 `Resources/monitor/src/monitor.js` 확인.
- app bundle 내부 `Resources/monitor/node_modules` 확인.
- ad-hoc signed app bundle 생성 확인.

Xcode 없이 실행:

- `/tmp/MongiPhaseCTest/Mongi.app`로 복사 후 `open -n` 실행.
- app process 실행 확인.
- MonitorRunner가 `source=bundle`로 monitor 실행 확인.
- monitor working directory가 `/private/tmp/MongiPhaseCTest/Mongi.app/Contents/Resources/monitor`인 것 확인.
- `state.json` 갱신 확인.
- `monitor.log`와 `error.log` 존재 확인.

Project root independence:

- 프로젝트 밖 `/tmp/MongiPhaseCTest/Mongi.app`에서 실행 성공.
- monitor는 bundle resource를 사용했다.
- state/log는 Phase A 표준 경로를 사용했다.
- Git output 판정은 `MONGI_OUTPUT_CWD`로 저장된 project root를 보게 하여 `SHIPPED` 유지 확인.

Lifecycle:

- MonitorRunner child process 종료 후 `runtime.json`에 `status = stopped`, `pid = null` 기록 확인.
- app 종료 후 `/tmp/MongiPhaseCTest/Mongi.app` 및 bundle monitor child process가 남지 않음 확인.

Failure:

- `MONGI_NODE_CANDIDATES=/tmp/mongi-missing-node`로 node not found 상황을 재현.
- `error.log`에 `MonitorRunner failure: node not found` 기록 확인.
- `runtime.json`에 `status = failed`, `lastError = node not found`, `pid = null` 기록 확인.

## Issues found

- Swift 6 concurrency 검사에서 `MonitorRunner.shared`와 termination handler capture가 막혔다.
- stdout/stderr를 FileHandle로 직접 연결하면 JS logger와 MonitorRunner append가 같은 log file에서 offset 충돌을 만들 수 있었다.
- app launch 직후 화면 초기 refresh가 별도 monitor를 한 번 더 실행해 중복 monitor run이 생겼다.
- app bundle monitor working directory가 Git repo가 아니어서 output status가 `NO_OUTPUT`으로 떨어질 수 있었다.
- node not found 검증 후 이전 `nodePath`가 runtime에 남을 수 있었다.

## Fixes applied

- `MonitorRunner`를 `@unchecked Sendable`로 명시했다.
- Process output은 Pipe로 받고 표준 로그에 append하도록 바꿨다.
- app launch monitor와 초기 status load를 분리했다.
- popover open도 저장된 status load만 수행하게 조정했다.
- `MONGI_OUTPUT_CWD`를 추가해 monitor 실행 cwd와 Git output cwd를 분리했다.
- node not found 시 `monitorPath`와 `nodePath`를 null로 기록하게 했다.

## Remaining risks

- bundled node는 아직 없다. 시스템 node가 필요하다.
- notarization과 DMG installer는 없다.
- Login Item과 launchd daemon 전환은 아직 없다.
- Finder 더블클릭은 `open -n` 기반 검증으로 대체했다. GUI menu bar process는 확인했지만 사용자가 보는 화면을 수동으로 최종 확인하는 절차는 남아 있다.
- Full diagnostics UI는 Phase D 범위다.

## Next phase readiness

V3 Phase D로 진행할 수 있다.

추천 범위:

- Full App Diagnostics Window.
- runtime/state/log 요약 UI.
- node not found, monitor failed, CDP stale, source stale 상태를 긴 로그 없이 읽기 쉽게 표시.
