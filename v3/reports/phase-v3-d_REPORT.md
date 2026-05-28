# Phase V3-D Report

## 목차

1. 변경 파일
2. 구현 결과
3. 이전 Phase 보완
4. 검증 결과
5. 실패와 재시도
6. 남은 불확실성
7. 수동 확인 방법
8. 다음 Phase

## 1. 변경 파일

- `macos/Mongi/Mongi/ContentView.swift`
  - 전체 앱 창을 Diagnostics 화면으로 교체.
- `macos/Mongi/Mongi/MongiApp.swift`
  - `WindowGroup`을 singleton `Window(id: "main")`로 변경.
- `macos/Mongi/Mongi/Views/DiagnosticsView.swift`
  - Overview, Sources, Recovery, Runtime, Actions, Logs 탭 구현.
- `macos/Mongi/Mongi/Services/DiagnosticsCommandWriter.swift`
  - `commands.json` atomic write, command id, 손상 파일 복구 처리.
- `macos/Mongi/Mongi/Services/LogTailReader.swift`
  - `monitor.log`, `error.log`, `health.log` tail reader 구현.
- `macos/Mongi/Mongi/Services/RuntimeDiagnosticsReader.swift`
  - `runtime.json` backward-compatible reader 구현.
- `macos/Mongi/Mongi/Services/DiagnosticsRedactor.swift`
  - summary/log 표시용 민감정보 redaction 구현.
- `macos/Mongi/Mongi/Services/MonitorRunner.swift`
  - app-managed monitor에서는 JS file logger mirror를 끄도록 환경변수 추가.
- `src/runtime/commandStore.js`
  - monitor command store reader/writer/processor 구현.
- `src/monitor.js`
  - pending command 로딩, reload-source 강제 reload, processed 기록 추가.
- `src/backends/cdpBackend.js`
  - manual reload flow 추가.
- `src/utils/logger.js`
  - `MONGI_DISABLE_FILE_LOGGER=true` 지원.
- `scripts/test-scenarios.js`
  - manual reload command, command store pending/processed/corrupt recovery scenario 추가.
- `README.md`
  - Diagnostics Window 사용법과 command/log 정책 추가.
- `v3/reports/phase-v3-d_REPORT.md`
  - Phase D 완료 보고서.

## 2. 구현 결과

- 메뉴의 `전체 앱 열기`는 기존 메뉴 구조를 유지하면서 `main` window를 연다.
- `main` window는 Diagnostics Window다.
- 이미 열린 창을 다시 여는 경우 새 창을 계속 만들지 않도록 `Window("Mongi", id: "main")`를 사용했다.
- 메뉴에는 긴 에러, target id, raw DOM, recovery table, log tail을 추가하지 않았다.
- Diagnostics Window는 다음 정보를 표시한다.
  - app version
  - monitor status, pid, heartbeat
  - runtime/state/config/commands/log paths
  - node path, monitor entrypoint
  - Codex/Claude backend, status, freshness, usage, lastFreshReadAt, lastAttemptAt, consecutiveFailures, lastRecoveryAction
  - reload cooldown, lastReloadAt, target rediscovery summary
  - `monitor.log`, `error.log`, `health.log` tail
- Actions 탭에 다음 액션을 추가했다.
  - Refresh Now
  - Reconnect Browser
  - Reload Codex Tab
  - Reload Claude Tab
  - Restart Monitor
  - Run Health Check
  - Open State Folder
  - Open Logs Folder
  - Copy Diagnostics Summary
- 수동 action은 `~/Library/Application Support/Mongi/commands.json`에 command id와 함께 기록한다.
- `commands.json`이 손상되면 `.corrupt.<timestamp>`로 백업하고 빈 command store로 복구한다.
- monitor는 pending command를 읽고 처리 후 `processedAt`, `status`, `result`를 기록한다.
- `reload-source` command는 해당 source에 manual reload를 강제한다.
- Diagnostics summary와 log tail은 Discord webhook, auth header, cookie, token, password 계열 값을 redaction한다.
- state/runtime/log 파일이 없거나 일부 필드가 없어도 UI는 `unknown`, `-`, `아직 생성된 로그 파일이 없습니다.`로 표시한다.

## 3. 이전 Phase 보완

- Phase C 실행 로그에서 app-managed monitor가 stdout 캡처와 JS file logger를 동시에 사용해 `monitor.log`가 중복 기록되는 문제가 보였다.
- `MonitorRunner`가 시작한 child process에는 `MONGI_DISABLE_FILE_LOGGER=true`를 넣고, JS logger는 이 값을 보면 직접 파일 쓰기를 건너뛰게 했다.
- Terminal/npm 직접 실행은 기존처럼 JS logger가 파일에 기록한다.

## 4. 검증 결과

통과:

- `node -c src/runtime/commandStore.js`
- `node -c src/backends/cdpBackend.js`
- `node -c src/monitor.js`
- `node -c src/utils/logger.js`
- `node -c scripts/test-scenarios.js`
- `swift build`
- `swift test`
- `npm run test:scenarios`
- `npm run status:json`
- `npm run health`
- `npm run release:local`
- `MONGI_HOME=<temp> MONGI_LOGS_DIR=<temp>/logs npm run monitor -- --dry-run-notifications`
  - `commands.json`의 `refresh-now` command가 `processed`로 기록되는 것 확인.
- `open -n dist/Release/Mongi.app`
  - packaged app 실행 확인.
  - `MonitorRunner started ... source=bundle ... cwd=.../Mongi.app/Contents/Resources/monitor` 확인.
  - `runtime.json`에 monitor status, heartbeat, node path 기록 확인.
  - 앱 종료 후 release app 및 bundle monitor child process가 남지 않음 확인.

실사용 상태 확인:

- `npm run status:json`에서 Codex/Claude 모두 `backend=cdp`, `status=healthy`, `freshness=fresh`.
- `npm run health`에서 backend/status/freshness와 target found 확인.
- `monitor.log`, `error.log`, `health.log` 경로 존재 확인.

## 5. 실패와 재시도

- 자동 UI 검증을 위해 `Computer Use`와 `System Events` 기반 창 조회를 시도했지만 macOS automation 권한 문제로 실패했다.
- 코드 레벨에서는 `Window("Mongi", id: "main")` singleton window와 기존 `openWindow(id: "main")` 연결을 확인했다.
- 실제 release app 실행과 monitor/log/runtime 갱신은 터미널에서 검증했다.
- app-managed monitor 로그 중복 문제를 발견해 logger 환경변수 방식으로 수정 후 재빌드, 재패키징, 재실행했다.

## 6. 남은 불확실성

- 메뉴에서 `전체 앱 열기`를 실제 클릭해 창이 앞으로 오는 동작은 automation 권한 때문에 직접 클릭 검증하지 못했다.
- Copy Diagnostics Summary는 Swift build로 컴파일 검증했지만, 클립보드 내용은 권한 있는 UI 클릭으로 확인하지 못했다.
- Open State Folder / Open Logs Folder도 코드 경로와 build 검증은 완료했지만, UI 클릭 자동 검증은 하지 못했다.

## 7. 수동 확인 방법

1. `npm run release:local`
2. `open dist/Release/Mongi.app`
3. menu bar의 Mongi 아이콘을 누른다.
4. `전체 앱 열기`를 누른다.
5. Diagnostics Window에서 Overview, Sources, Recovery, Runtime, Actions, Logs 탭을 확인한다.
6. Actions 탭에서 `Run Health Check`를 누르고 `health.log` tail이 갱신되는지 확인한다.
7. `Reload Codex Tab` 또는 `Reload Claude Tab`을 누른 뒤 아래 파일에 command가 기록되는지 확인한다.
   - `~/Library/Application Support/Mongi/commands.json`
8. `Copy Diagnostics Summary`를 누르고 민감정보가 노출되지 않는지 확인한다.
9. 앱을 종료한 뒤 bundle monitor child process가 남지 않는지 확인한다.

## 8. 다음 Phase

- Phase E: launchd/Login Item 통합.
