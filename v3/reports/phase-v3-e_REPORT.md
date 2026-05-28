# Phase V3-E Report

Launch / Login / Background Stability

## 목차

1. 변경 파일
2. 구현 결과
3. 아키텍처 결정
4. 검증 결과
5. 실패와 재시도
6. 남은 불확실성
7. 수동 확인 방법
8. 다음 Phase

## 1. 변경 파일

JS (monitor / runtime):

- `src/runtime/paths.js`
  - `monitor.lock` 경로(`lockPath`) 추가 및 export.
- `src/runtime/monitorLock.js` (신규)
  - `acquireLock`, `refreshLock`, `releaseLock`, `readLock`, `isPidAlive`.
  - 살아있는 다른 프로세스가 잡은 lock은 차단, 죽은 프로세스의 stale lock은 교체.
- `src/runtime/runtimeMeta.js`
  - 통합 스키마로 재작성: `recordMonitorRunning`, `recordMonitorHeartbeat`, `recordMonitorStopped`.
  - `computeMonitorStatus`: pid 생존 + heartbeat age 기반으로 running/stale/crashed/stopped 판단 (`DEFAULT_HEARTBEAT_STALE_MS = 90s`).
- `src/monitor.js`
  - `main()`을 `runMonitorCycle()`(1회 polling)과 새 `main()`(모드 분기)으로 분리.
  - `--loop`/`MONGI_MONITOR_LOOP` 시 장기 실행 daemon 모드(`runLoop`): heartbeat timer + poll timer + SIGTERM/SIGINT graceful shutdown.
  - single-shot/loop 모두 lock 획득; 살아있는 다른 monitor가 있으면 skip.
  - owner/entrypoint/nodePath를 환경변수에서 읽어 runtime.json에 기록.
- `scripts/run-monitor.sh`
  - launchd single-shot 실행을 `MONGI_MONITOR_OWNER=launchd`로 태그.
- `scripts/test-scenarios.js`
  - lock(획득/live 중복 차단/stale 교체/refresh/release) 시나리오.
  - runtime heartbeat(running/crashed/stale/stopped) 시나리오.

Swift (macOS app):

- `macos/Mongi/Mongi/Services/MongiRuntimePaths.swift`
  - `lockFile` 경로 추가.
- `macos/Mongi/Mongi/Services/MonitorStatusEvaluator.swift` (신규)
  - `computeMonitorStatus`의 Swift 미러. runtime.json + monitor.lock을 읽어 effective status(running/stale/crashed/...)와 lock 정보 계산.
- `macos/Mongi/Mongi/Services/MonitorRunner.swift`
  - monitor를 `--loop`로 시작, owner/entrypoint/node env 전달.
  - 시작 전 effective status 확인 → 이미 running이면 시작 skip(중복 방지). owner가 앱이면 adopt.
  - owner-safe stop/restart: 앱이 시작한 child 또는 adopt한 app-owned pid만 종료, 외부/launchd monitor는 보존.
  - 실행 중 JS가 runtime.json을 쓰므로 Swift는 race를 피해 실패 케이스(spawn 실패/비정상 종료)에서만 기록.
- `macos/Mongi/Mongi/Services/LoginItemService.swift` (신규)
  - `SMAppService.mainApp` 기반 enable/disable/currentState. 사용자가 켜기 전 자동 등록 없음.
- `macos/Mongi/Mongi/Services/RuntimeDiagnosticsReader.swift`
  - `MonitorStatusEvaluator` 기반으로 재작성: effective status, owner, mode, heartbeat age, lock 정보 포함.
- `macos/Mongi/Mongi/MongiAppViewModel.swift`
  - `loginItemState`, `monitorRuntime` 노출. `refreshMonitorRuntime`, `refreshLoginItemState`, `setLoginItemEnabled`.
  - `monitorStatusText`/`monitorIsRunning`을 effective status 기반으로 변경, `monitorIsHealthy` 추가.
- `macos/Mongi/Mongi/Views/DiagnosticsView.swift`
  - `Background` 탭 추가: Start at Login 토글, monitor effective status, owner/mode/pid/heartbeat age, lock 상태, Restart Monitor.
  - Runtime 탭에 effective/recorded status, pid alive, heartbeat age, owner, mode, lock path 추가.
  - 헤더 pill 색을 effective status 기반으로.

문서:

- `README.md`
  - "Background stability & Login Item (V3 Phase E)" 섹션 추가, Diagnostics 탭 목록과 제한 사항 갱신.
- `v3/reports/phase-v3-e_REPORT.md`
  - 본 보고서.

## 2. 구현 결과

- Start at Login ON/OFF: Diagnostics `Background` 탭의 토글. `SMAppService`로 등록/해제, 사용자가 켜기 전엔 등록하지 않는다.
- 앱 시작 시 monitor 자동 시작: 이미 healthy하게 running이 아니면 `--loop`로 새 monitor를 띄운다.
- 중복 실행 방지: runtime pid effective check(앱) + `monitor.lock`(프로세스) 이중 방어.
- heartbeat 기록: loop monitor가 30초마다 `runtime.json.lastHeartbeatAt` 갱신.
- stale/crash 감지: pid 죽음 → crashed, heartbeat 90초 초과 → stale.
- Restart Monitor: 앱이 시작한 monitor를 stop 후 새로 start. 외부 monitor는 안전을 위해 건드리지 않음.
- 앱 종료 시 정리: 앱이 시작한 child monitor에 SIGTERM → monitor가 stopped 기록 + lock 해제.
- stale lock 정리: 죽은 pid의 lock은 다음 start에서 교체.
- launchd 충돌: 앱 loop가 lock을 잡고 있으면 launchd single-shot이 스스로 skip. README에 문서화.
- Diagnostics 표시: Login Item 상태, monitor pid, effective/recorded status, heartbeat age, lock 보유/소유자/stale.

## 3. 아키텍처 결정

- **monitor.js는 원래 single-shot**이었고 launchd가 600초마다 1회씩 실행했다. heartbeat가 "멈추는" 것을 감지하려면 장기 실행 프로세스가 필요하므로 `--loop` daemon 모드를 추가했다. launchd 경로(flag 없음)는 그대로 single-shot으로 유지해 기존 동작과 테스트를 깨지 않았다.
- **runtime.json `monitor` 블록의 단일 writer는 monitor 프로세스**로 정했다. 앱은 owner/entrypoint/node를 env로 넘기고, 실행 중에는 runtime.json을 읽기만 한다. 앱이 쓰는 경우는 monitor가 살아있지 않은 두 케이스(spawn 실패, 비정상 종료)뿐이라 race가 없다.
- **effective status 로직을 JS(`computeMonitorStatus`)와 Swift(`MonitorStatusEvaluator`)에 동일하게** 두어 health/status CLI와 앱이 같은 판단을 하도록 했다. 임계값(90s)도 양쪽에서 일치시켰다.
- **owner 필드로 종료 안전성**을 보장했다. 앱은 `owner == "Mongi.app"`인 monitor만 종료한다.

## 4. 검증 결과

통과 (코드/단위):

- `node -c` : `src/monitor.js`, `src/runtime/monitorLock.js`, `src/runtime/runtimeMeta.js`, `src/runtime/paths.js`, `scripts/test-scenarios.js`.
- `npm run test:scenarios` — 신규 lock/heartbeat 시나리오 포함 전체 통과.
- `swift build` 성공.
- `swift test` 9 tests 통과.
- 격리(temp `MONGI_HOME`) node 테스트: lock 획득/차단/stale 교체/release, runtime running/crashed/stale/stopped 계산 모두 통과.

통과 (격리 프로세스):

- `node src/monitor.js --loop` (temp dir): runtime.json running + heartbeat 1초 주기 갱신, lock 보유, 중복 실행 시 skip 경고, SIGTERM 시 stopped + lock 해제 확인.
- `node src/monitor.js` single-shot (temp dir, owner=launchd): 정상 polling 후 stopped 기록 + lock 해제.

통과 (실제 release app, `~/Library/Application Support/Mongi`):

- `npm run release:local` 후 `open -n dist/Release/Mongi.app`.
- runtime.json: `owner=Mongi.app`, `mode=loop`, `status=running`, child process는 `monitor.js --loop --dry-run-notifications`.
- heartbeat: 약 30초 간격으로 `lastHeartbeatAt` 전진 확인.
- 앱 2회 실행: monitor child는 1개만 유지(중복 없음).
- monitor `kill -9`: 앱 terminationHandler가 `status=failed`, `lastError="monitor exited with code 9"` 기록, effective=failed, 프로세스 없음.
- 재실행: stale lock(죽은 pid) 교체, 새 pid로 running.
- 앱 종료: child monitor 종료(none), `status=stopped`, lock 해제.
- launchd 충돌: 앱 loop가 lock 보유 중 `MONGI_MONITOR_OWNER=launchd node src/monitor.js` 실행 → `Another monitor already holds the lock; skipping` 경고, runtime pid 변동 없음.

실사용 상태:

- 검증 중 실제 CDP Chrome 세션이 열려 있어 Codex/Claude 모두 `backend=cdp`, `status=healthy`, `freshness=fresh`로 polling 성공.
- `npm run status:json`, `npm run health` 정상.

## 5. 실패와 재시도

- 초기 가정은 "monitor가 이미 장기 실행"이었으나, 코드 확인 결과 single-shot이었다. → daemon `--loop` 모드를 추가하고 launchd single-shot은 그대로 두는 방식으로 재설계했다.
- JS `recordMonitorStart`/heartbeat와 Swift `writeRuntime`이 runtime.json `monitor`를 동시에 쓰며 필드가 충돌했다. → "monitor가 단일 writer" 규칙으로 정리하고 Swift 쓰기를 실패 케이스로 한정해 race를 제거했다.
- ISO8601 fractional seconds 파싱 문제를 막기 위해 Swift 파서를 fractional/plain 두 포맷으로 fallback 처리했다.

## 6. 남은 불확실성

- Start at Login 토글의 실제 클릭과 macOS 승인(시스템 설정 > 로그인 항목) 플로우는 automation 권한 때문에 직접 클릭 검증을 하지 못했다. 코드는 `swift build`로 컴파일 검증했고 `SMAppService.currentState()`는 앱 시작 시 읽는다. ad-hoc 서명 빌드라 실제 로그인 자동 실행은 서명/배포 환경에서 다시 확인하는 것이 안전하다.
- Diagnostics `Restart Monitor` 버튼 클릭 자체는 automation으로 누르지 못했지만, 버튼이 호출하는 `stop()+start()` 경로(앱 종료 시 child 종료 + 재실행 시 stale lock 교체 + 새 monitor 시작)를 실제 프로세스로 각각 검증했다.
- 현재 사용자 환경에는 launchd LaunchAgent가 load되어 있다. lock 덕분에 동시 polling은 막히지만, Login Item을 상시 사용한다면 `npm run launchd:uninstall`을 권장한다(README에 명시).

## 7. 수동 확인 방법

1. `npm run release:local`
2. `open dist/Release/Mongi.app`
3. 메뉴 → `전체 앱 열기` → `Background` 탭.
4. monitor effective status가 `실행 중`, owner `Mongi.app`, mode `loop`, heartbeat age가 작은 값인지 확인.
5. `cat ~/Library/Application\ Support/Mongi/runtime.json` 으로 `status=running`, heartbeat 갱신 확인.
6. `cat ~/Library/Application\ Support/Mongi/monitor.lock` 으로 lock owner/pid 확인.
7. monitor pid를 `kill -9` 한 뒤 `Background` 탭 새로고침 → status가 failed/crashed로 바뀌는지 확인.
8. `Restart Monitor` → 다시 running 복구 확인.
9. `Start at Login` 토글을 켜고 `시스템 설정 > 일반 > 로그인 항목`에 Mongi가 추가되는지 확인.
10. 앱 종료 후 `pgrep -fl "monitor.js --loop"` 로 child가 정리됐는지 확인.

## 8. 다음 Phase

- 코드 서명/notarization 위에서 Login Item 자동 실행 end-to-end 검증.
- (선택) Node health/status CLI에 effective monitor status 표면화.
- (선택) launchd를 정식 advanced 옵션으로 문서/스크립트 정리.
