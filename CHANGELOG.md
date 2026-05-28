# Changelog

본 프로젝트는 개인용 로컬 도구다. 버전은 개인 실사용 기준으로 매긴다.

## [3.0.0-rc.1] - 2026-05-28

V3 Release Candidate. 기능 추가보다 안정성/검증/문서화에 집중한 릴리즈다.

### Added

- **Runtime path hardening (Phase A):** state/config/runtime/commands는 `~/Library/Application Support/Mongi`, 로그는 `~/Library/Logs/Mongi`로 통일. `src/runtime/paths.js` 단일 resolver, `MONGI_HOME`로 테스트 격리, Swift `MongiRuntimePaths`가 동일 경로 사용.
- **Usage backend reliability layer (Phase B):** source별 status(`healthy`/`stale`/`failed`/`missing`)와 freshness(`fresh`/`stale`/`unknown`) 구분. 첫 실패에서 last known usage를 지우지 않고 stale로 보존, consecutiveFailures 추적.
- **CDP reload recovery (Phase C):** threshold 실패 시 tab reload 시도, reload cooldown으로 무한 reload 방지, target rediscovery로 닫힌/이동한 탭 복구.
- **Xcode-free app packaging (Phase C):** `npm run release:local`로 `dist/Release/Mongi.app` 생성. 시스템 node 탐색, bundle 내부 `Resources/monitor`에서 monitor 실행.
- **Full App Diagnostics Window (Phase D):** Overview/Sources/Recovery/Runtime/Background/Actions/Logs 탭. 수동 action은 `commands.json`을 통해 monitor에 전달. summary/log는 redaction 후 표시.
- **Monitor heartbeat & duplicate prevention (Phase E):** monitor `--loop` daemon 모드가 `runtime.json` heartbeat를 주기적으로 갱신. `monitor.lock` + runtime pid check로 중복 실행 방지. pid 죽음→`crashed`, heartbeat 멈춤→`stale` 판단.
- **Login Item support (Phase E):** Diagnostics `Background` 탭에서 `SMAppService` 기반 Start at Login ON/OFF. 사용자가 켜기 전 자동 등록 없음.
- **Owner-safe monitor lifecycle (Phase E):** 앱은 `owner == "Mongi.app"`인 monitor만 종료. launchd/외부 monitor는 보존. 앱 종료 시 자신이 시작한 child 정리.
- **QA / RC notes (Phase F):** 핵심 QA 시나리오 검증, security/privacy review, performance review, `known-issues.md`, RC versioning(3.0.0-rc.1), local release artifact.

### Changed

- `runtime.json` `monitor` 블록 스키마 통일: `pid`, `status`, `startedAt`, `lastHeartbeatAt`, `owner`, `mode`, `entrypoint`, `nodePath`. monitor 프로세스가 단일 writer.
- `monitor.js`를 single-shot `runMonitorCycle()`와 mode 분기 `main()`(loop/single)으로 분리. launchd 경로는 single-shot 유지.
- `run-monitor.sh`는 launchd 실행을 `MONGI_MONITOR_OWNER=launchd`로 태그해 앱 loop monitor와 구분.
- app 버전을 `package.json`에서 읽어 `Info.plist`에 주입(`3.0.0-rc.1`).

### Notes

- 기본 background 실행 방식은 앱(Login Item)이다. 기존 launchd LaunchAgent는 advanced/future 옵션으로 남는다. 앱 loop가 lock을 잡고 있으면 launchd single-shot은 스스로 skip한다.
- production backend는 CDP 하나뿐이다. statusLine/wham/Extension/WKWebView backend는 V3.1/V4 spike로 미룬다.
