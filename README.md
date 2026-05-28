# Mongi Usage Coach

## 목차

- Mongi란
- V2 output status
- V1 구조
- Runtime paths (V3)
- Quick start
- Daily workflow
- SwiftUI/menu bar app
- V2 usage semantics
- V3 backend reliability
- Local release app (V3 Phase C)
- Diagnostics window (V3 Phase D)
- Background stability & Login Item (V3 Phase E)
- V3 Release Candidate (Phase F)
- Safe verification
- Important commands
- Troubleshooting
- Docs
- Known limitations
- V1 status

## Mongi란

Mongi Usage Coach는 Codex와 Claude 유료 사용량이 실제 개발 산출물로 이어지도록 돕는 개인용 로컬 코치다.

Mongi는 Codex/Claude usage page를 주기적으로 읽고, 사용량 회복, 주간 방치, 세션 멈춤, 진단 실패를 감지해 필요한 경우 Discord로 작은 다음 행동을 알려준다.

## V2 output status

Mongi V2의 primary status는 Git output 기준이다.

Core status는 세 가지뿐이다.

- `NO_OUTPUT`: shipped 또는 local Git output이 감지되지 않음
- `LOCAL_ONLY`: local 변경이나 unpushed commit은 있지만 오늘 shipped evidence는 없음
- `SHIPPED`: 오늘 upstream/remote 기준 shipped evidence가 있음

AI usage는 secondary signal이다. Quiet hours는 modifier이며 core status가 아니다.

Discord 알림도 V2에서는 output status를 먼저 보여준다. 메시지는 3줄 이하이며, AI usage percentage는 있으면 짧게 보조 정보로만 붙는다. Quiet hours는 알림 전송 여부에만 영향을 주고 core status를 바꾸지 않는다.

## V1 구조

- Local Mac 전용
- Chrome CDP 기반 usage page 모니터링
- Node.js monitor core
- `launchd` 10분 주기 실행
- 파일 기반 상태 (V3부터 `~/Library/Application Support/Mongi/state.json`, 아래 Runtime paths 참고)
- 파일 기반 실행 로그 (V3부터 `~/Library/Logs/Mongi/`)
- Discord Webhook 알림
- SwiftUI macOS wrapper와 menu bar 상태 표시

V1은 SaaS, 웹 대시보드, 데이터베이스, 외부 서버 없이 동작한다.

## Runtime paths (V3)

V3부터 Mongi의 runtime 파일은 프로젝트 루트가 아니라 macOS 표준 위치에 저장된다.
JS monitor, npm scripts, Swift menu bar 앱이 모두 같은 경로를 사용한다.

State / Config / Runtime / Commands:

- `~/Library/Application Support/Mongi/state.json`
- `~/Library/Application Support/Mongi/config.json`
- `~/Library/Application Support/Mongi/runtime.json`
- `~/Library/Application Support/Mongi/commands.json`

Logs:

- `~/Library/Logs/Mongi/monitor.log`
- `~/Library/Logs/Mongi/error.log`
- `~/Library/Logs/Mongi/health.log`

정책:

- 모든 state/log/config 접근은 `src/runtime/paths.js` resolver를 통한다.
- runtime 경로는 `process.cwd()`나 프로젝트 루트에 의존하지 않는다.
- Xcode, Terminal, packaged `.app` 어디서 실행해도 동일한 경로를 사용한다.
- 필요한 디렉터리는 monitor/앱 시작 시 자동 생성된다 (`ensureRuntimeDirs`).
- `config.json`이 없어도 기본값으로 동작한다.
- 테스트는 `MONGI_HOME` 환경변수로 runtime 경로를 temp 디렉터리로 격리할 수 있다.
- Swift 앱은 `MongiRuntimePaths`(FileManager 기반)로 같은 경로를 계산한다.

기존 `STATE_FILE_PATH`에 들어 있던 `data/state.json` 같은 상대 경로는
자동으로 표준 위치로 이전된다. 절대 경로를 지정하면 그 경로를 그대로 사용한다.

## Quick start

```bash
npm install
cp .env.example .env
npm run start:chrome
npm run launchd:install
npm run health
```

`.env`에는 `DISCORD_WEBHOOK_URL`을 직접 넣는다. Webhook URL은 문서, 코드, 로그, Git에 남기지 않는다.

Chrome이 열리면 Codex와 Claude usage page에서 직접 로그인하고, Turnstile이나 수동 인증이 뜨면 직접 통과한다.

## Daily workflow

Morning:

1. Mongi app을 연다.
2. menu bar 상태를 확인한다.
3. CDP가 unreachable이면 `Start Mongi`를 누른다.
4. 상태가 `OK` 또는 현재 조치 가능한 warning인지 확인한다.
5. 개발을 시작한다.

During development:

- Discord 알림은 작은 작업 하나로 바로 연결한다.
- Codex는 repo 작업, 구현, 테스트, 디버깅에 쓴다.
- Claude는 기획, 긴 문서, 리뷰, 큰 맥락 정리에 쓴다.

End of day:

```bash
npm run daily:summary
```

Weekly:

```bash
npm run value:review
```

자세한 운영 흐름은 [V1_REAL_USE_GUIDE.md](/Users/shadowmoon/nonoNangbi/nonoNangbi/docs/V1_REAL_USE_GUIDE.md)를 본다.

## SwiftUI/menu bar app

V2의 기본 사용 흐름은 terminal이 아니라 menu bar app이다.

앱 패키징:

```bash
npm run release:local
```

앱 열기:

```bash
npm run open:app
```

개발 중 컴파일 후 바로 실행:

```bash
npm run compile:app
```

패키징 결과물은 기본적으로 `dist/Release/Mongi.app`에 생성된다. 이 앱을 열면 menu bar에 Mongi가 나타나고, popover에서 output status, usage, refresh cadence를 확인한다.

앱에서 가능한 작업:

- 상태 새로고침: `npm run monitor -- --dry-run-notifications` 후 `npm run status:json`
- popover 열 때 상태 자동 새로고침
- refresh cadence 선택: manual, 5m, 10m, 15m
- background refresh는 조용히 상태만 갱신하며 매번 Discord 알림을 보내지 않음
- menu bar popover는 output status를 한국어 label로 보여주고, Codex/Claude remaining을 각각 compact gauge bar 두 개로 보여줌 (5시간/주간)
- 사용량을 읽지 못한 경우 gauge는 빈 채로 두고 `확인 안 됨`을 표시한다. 누락된 값은 100%로 채우지 않는다
- Full App은 Codex/Claude의 detailed usage bar, used percent, reset 정보를 보여줌
- reset countdown은 reset 시간이 있으면 표시하고, 없으면 확인 안 됨 상태로 표시함
- CDP Chrome 시작: `npm run start:chrome`
- health 확인: `npm run health`
- Daily Summary 확인: `npm run daily:summary`
- Value Review 확인: `npm run value:review`
- project root 선택 또는 reset

앱은 Node core를 재작성하지 않는다. 기존 npm scripts를 실행하고 결과를 보여주는 로컬 wrapper다.

CLI 명령은 개발, 디버깅, 검증용이다. 정상 사용자는 TUI나 terminal dashboard를 열 필요가 없다.

## V2 usage semantics

Menu bar usage 값은 기본적으로 remaining percentage다.

- Codex Short: 5-hour usage window의 remaining
- Codex Weekly: weekly usage window의 remaining
- Claude Short: current session used 값을 읽고 remaining으로 변환
- Claude Weekly: all-models 또는 weekly used 값을 읽고 remaining으로 변환

Popover의 usage 요약은 provider 별로 두 개의 compact gauge bar로 remaining을 표시한다. 예: Codex `5시간 99% 남음`, `주간 69% 남음`. Claude도 `5시간 33% 남음`, `주간 96% 남음`처럼 같은 label을 쓴다.

Parser는 `할인`, `쿠폰`, `프로모션`, `discount`, `promo`, `coupon`, `sale` 같은 anti-keyword가 포함된 percent token을 사용량 후보에서 제외한다. 또한 keyword에 매칭되는 후보가 없으면 더 이상 임의 percent로 fallback하지 않는다. 즉, 값이 모호하면 `확인 안 됨` 상태로 노출되고 Discord usage line에서도 빠진다.

Full App의 usage bar도 remaining 기준이다. Used 값은 보조 metadata로만 표시한다.

내부 output status는 `SHIPPED`, `LOCAL_ONLY`, `NO_OUTPUT`을 유지하지만 사용자에게는 다음처럼 표시한다.

- `SHIPPED`: 오늘 푸시함
- `LOCAL_ONLY`: 로컬 작업만 있음
- `NO_OUTPUT`: 산출물 없음

Discord 메시지는 한국어 우선 3줄 이하로 보낸다. Background refresh와 status-json 조회는 Discord를 보내지 않는다. `Start Mongi`로 CDP Chrome을 실제로 시작할 때만 start notification을 보낸다.

최신 값이 필요하면 refresh를 실행한다. Last refreshed와 각 provider의 last checked 시간이 stale data 여부를 확인하는 기준이다.

Mongi는 CDP-controlled Chrome의 provider tab을 source로 읽는다. 일반 Chrome이나 다른 profile에서 보고 있는 화면은 Mongi가 읽는 source가 아닐 수 있다.

Live source 확인:

```bash
npm run verify:usage-source
```

이 명령은 Codex/Claude별 selected tab URL, title, target id, safe percentage context, parser output, status-json 비교를 출력한다. Provider tab은 읽기 전에 reload되어 stale DOM을 줄인다.

사용량 추출이 실패하면 이전 값은 보존되지만 fresh 값처럼 표시하지 않는다. status-json과 menu bar는 `lastSuccessfulCheckedAt`, `lastAttemptedAt`, stale/failure 상태를 노출하고, Discord usage line은 stale provider 값을 생략한다. 누락된 값은 100%로 채우지 않는다.

## V3 backend reliability

Production usage backend는 계속 CDP다. V3부터 CDP 수집은 `UsageBackend` abstraction 뒤에서 동작하며, `state.json`은 기존 `services.codex/claude`와 함께 `sources.codex/claude` reliability metadata를 저장한다.

Source metadata:

- `backend`: 현재 backend id. V3 Phase B production 값은 `cdp`.
- `status`: `healthy`, `degraded`, `stale`, `reconnecting`, `refreshing`, `missing`, `failed`, `disabled`.
- `freshness`: `fresh`, `stale`, `unknown`, `disabled`.
- `usage`: 마지막 fresh read에서 얻은 normalized usage 값.
- `lastFreshReadAt`: 마지막 성공 read 시각.
- `lastAttemptAt`: 마지막 read 시도 시각.
- `consecutiveFailures`: source별 연속 실패 횟수.
- `lastError`: 마지막 실패 이유.
- `lastRecoveryAction`: `target-rediscovery-success`, `reload-success`, `reload-failed`, `reload-skipped-cooldown` 같은 최근 복구 결과.
- `lastReloadAt`: 마지막 reload 시도 시각.
- `target`: 선택된 CDP target의 안전한 metadata.

실패 시 usage 값은 지우지 않는다. Codex는 연속 실패 3회, Claude는 연속 실패 2회부터 reload 후보가 되며, 같은 source는 5분 안에 중복 reload하지 않는다. Reload 전에 target rediscovery를 먼저 수행한다.

## Local release app (V3 Phase C)

Local release 생성:

```bash
npm run release:local
```

결과물:

- `dist/Release/Mongi.app`
- `dist/monitor`
- `Mongi.app/Contents/Resources/monitor`

실행:

```bash
open dist/Release/Mongi.app
```

동작 정책:

- 앱은 시작 시 `Resources/monitor/src/monitor.js`를 우선 실행한다.
- bundle monitor가 없으면 개발 편의를 위해 선택된 project root의 `src/monitor.js`를 fallback으로 사용한다.
- monitor working directory는 bundle 내부 `Resources/monitor`다.
- state/config/runtime/log는 app bundle 안이 아니라 macOS 표준 경로를 사용한다.
- stdout은 `~/Library/Logs/Mongi/monitor.log`, stderr는 `~/Library/Logs/Mongi/error.log`에 남긴다.
- 앱이 직접 시작한 monitor child process는 앱 종료 시 정리한다.

Node 정책:

- bundled node는 아직 포함하지 않는다.
- 시스템 node를 사용한다.
- 탐색 순서: `/opt/homebrew/bin/node`, `/usr/local/bin/node`, `/usr/bin/node`, `/usr/bin/env node`.
- node를 못 찾거나 monitor start가 실패하면 앱은 조용히 죽지 않고 `runtime.json`과 `error.log`에 원인을 남긴다.

제한:

- notarization, DMG installer, auto updater는 아직 없다.
- Login Item 관리는 V3 Phase E에서 추가했다 (아래 참고).
- Release app은 사용자의 시스템 node와 CDP Chrome 세션이 필요하다.

## Diagnostics window (V3 Phase D)

메뉴의 `전체 앱 열기`는 전체 Diagnostics Window를 연다.

표시 정보:

- Overview: app version, monitor status, CDP status, Codex/Claude 요약, last updated.
- Sources: source별 backend, status, freshness, usage, lastFreshReadAt, lastAttemptAt, consecutiveFailures, lastError 요약.
- Recovery: lastRecoveryAction, lastReloadAt, reload cooldown, target rediscovery 상태.
- Runtime: monitor effective/recorded status, pid, heartbeat age, owner, mode, runtime paths, log paths, node path, monitor entrypoint.
- Background (V3 Phase E): Start at Login 토글, effective monitor status, owner/mode, pid, heartbeat age, lock 상태, Restart Monitor.
- Actions: Refresh Now, Reconnect Browser, Reload Codex Tab, Reload Claude Tab, Restart Monitor, Run Health Check, folder open, diagnostics summary copy.
- Logs: `monitor.log`, `error.log`, `health.log` 최근 tail.

수동 action은 `~/Library/Application Support/Mongi/commands.json`에 command id와 함께 기록된다. `commands.json`이 손상되어도 앱과 monitor는 죽지 않고 손상 파일을 백업한 뒤 새 command store로 복구한다.

Diagnostics summary와 log tail은 Discord webhook, auth header, cookie, token, password 계열 값을 redaction한 뒤 표시한다.

## Background stability & Login Item (V3 Phase E)

앱은 켜질 때 background monitor를 직접 관리한다.

Monitor 실행 모델:

- 앱은 monitor를 `--loop` 모드로 시작한다. 이 모드는 한 번만 도는 single-shot이 아니라 polling을 반복하는 장기 실행 프로세스다.
- 기본 poll 주기는 10분(`MONGI_MONITOR_POLL_INTERVAL_MS`), heartbeat 주기는 30초(`MONGI_MONITOR_HEARTBEAT_INTERVAL_MS`)다.
- monitor는 `runtime.json`의 `monitor` 블록을 단일 소스로 기록한다: `pid`, `status`, `startedAt`, `lastHeartbeatAt`, `owner`, `mode`, `entrypoint`, `nodePath`.

중복 실행 방지:

- monitor는 `~/Library/Application Support/Mongi/monitor.lock`을 잡는다 (`pid`, `owner`, `mode`).
- 살아있는 다른 프로세스가 lock을 잡고 있으면 새 monitor는 실행을 건너뛴다.
- 죽은 프로세스가 남긴 stale lock은 다음 실행에서 자동으로 교체된다.
- 앱을 여러 번 실행해도, runtime pid check와 lock 덕분에 monitor는 하나만 돈다.

상태 판단:

- 기록된 status가 `running`이라도, pid가 죽었으면 `crashed`, heartbeat가 90초 이상 멈추면 `stale`로 본다.
- Diagnostics의 effective status는 이 규칙(`src/runtime/runtimeMeta.js`의 `computeMonitorStatus`, Swift `MonitorStatusEvaluator`)으로 계산한다.

소유권 안전:

- 앱은 `owner == "Mongi.app"`인, 즉 자신이 시작한 monitor만 종료한다.
- launchd나 외부에서 시작한 monitor는 종료하지 않는다.
- 앱 종료 시 자신이 시작한 monitor child를 정리한다.

Start at Login:

- Diagnostics의 `Background` 탭에서 `로그인 시 Mongi 자동 실행`을 켜고 끌 수 있다 (`SMAppService.mainApp`, macOS 13+).
- 사용자가 직접 켜기 전에는 절대 자동으로 Login Item을 등록하지 않는다.
- 처음 켤 때 macOS가 승인을 요구하면 `시스템 설정 > 일반 > 로그인 항목`에서 허용한다.

launchd와의 관계:

- 이번 Phase의 기본 background 실행 방식은 **앱(Login Item)** 이다.
- 기존 `npm run launchd:install` LaunchAgent는 advanced/future 옵션으로 남겨둔다.
- launchd는 `run-monitor.sh`를 통해 single-shot으로 도는데, 이때 `MONGI_MONITOR_OWNER=launchd`로 태그된다.
- **충돌 주의:** 앱 loop monitor가 lock을 잡고 있는 동안 launchd single-shot이 뜨면, launchd 실행은 lock을 보고 스스로 skip한다 (로그에 `Another monitor already holds the lock` 경고). 즉 둘이 동시에 polling하지 않는다.
- 그래도 두 방식을 모두 쓰고 싶지 않다면, Login Item을 쓸 때는 `npm run launchd:uninstall`로 LaunchAgent를 내리는 것을 권장한다.

Diagnostics `Background` 탭에서 Login Item 상태, effective monitor status, owner/mode, pid, heartbeat age, lock 보유/소유자/stale 여부를 확인하고 `Restart Monitor`로 복구할 수 있다.

## V3 Release Candidate (Phase F)

현재 버전: **3.0.0-rc.1** (개인 실사용 RC). 버전은 `package.json`, app `Info.plist`(`CFBundleShortVersionString`), Diagnostics Window header에서 확인할 수 있다.

RC app 실행:

```bash
npm install            # 최초 1회 (node_modules 필요)
npm run start:chrome   # CDP Chrome 준비 후 Codex/Claude usage page 로그인
npm run release:local  # dist/Release/Mongi.app 생성
open dist/Release/Mongi.app
```

앱을 켜면 background monitor가 자동으로 시작되고(`--loop`), 메뉴바 아이콘과 Diagnostics Window에서 상태를 볼 수 있다. Start at Login은 Diagnostics `Background` 탭에서 켠다.

보안/프라이버시:

- Mongi는 외부 서버로 데이터를 보내지 않는다. 유일한 외부 전송은 사용자가 `.env`에 직접 넣은 Discord Webhook이며, app-managed monitor는 기본 dry-run이라 알림을 보내지 않는다.
- CDP endpoint는 로컬 `http://127.0.0.1:9222`만 사용한다. remote debugging 포트는 로컬에서만 노출하고 외부에 개방하지 않는다.
- 로그/state/runtime/commands/diagnostics summary에는 token, cookie, auth header, webhook URL이 기록되지 않는다 (JS logger와 Swift `ShellResult.sanitize`/`DiagnosticsRedactor`가 redaction).

알려진 한계와 후속 계획은 [known-issues.md](/Users/shadowmoon/nonoNangbi/nonoNangbi/known-issues.md), 변경 요약은 [CHANGELOG.md](/Users/shadowmoon/nonoNangbi/nonoNangbi/CHANGELOG.md)를 본다.

V3.1 / V4 backend 방향 (예정, 이번 RC에는 미포함):

- V3.1 spike: Claude statusLine backend, Codex CLI(wham) backend 같은 CDP 비의존 source 조사.
- V4 후보: WKWebView 내장 세션, Browser Extension 기반 usage 수집, bundled node, notarization/DMG 배포.
- 현재 production backend는 CDP 하나뿐이며, 위 항목은 조사/실험 단계로만 둔다.

## Safe verification

V1 안전 검증:

```bash
npm run verify:local:safe
```

이 명령은 Discord 실제 테스트 메시지를 보내지 않는다. CDP가 필요한 검사는 CDP Chrome이 켜져 있어야 정상으로 통과한다.

`npm run test:discord`는 실제 Discord 메시지를 보내므로 수동으로 명확히 원할 때만 실행한다.

## Important commands

```bash
npm run health
npm run status:json
npm run daily:summary
npm run value:review
npm run policy:check
npm run logs:summary
npm run start:chrome
npm run launchd:status
```

명령별 목적과 Discord 발송 가능성은 [COMMAND_REFERENCE.md](/Users/shadowmoon/nonoNangbi/nonoNangbi/docs/COMMAND_REFERENCE.md)를 본다.

## Troubleshooting

자주 보는 문제:

- CDP reachable: no
- launchd loaded: no
- usage page not open
- no Discord notification
- quiet hours active
- npm not found in SwiftUI app
- Chrome login expired
- Turnstile/manual verification required

해결 절차는 [TROUBLESHOOTING.md](/Users/shadowmoon/nonoNangbi/nonoNangbi/docs/TROUBLESHOOTING.md)를 본다.

## Docs

전체 문서 입구는 [DOCS_INDEX.md](/Users/shadowmoon/nonoNangbi/nonoNangbi/docs/DOCS_INDEX.md)다.

V1 완료 전 확인은 [V1_RELEASE_CHECKLIST.md](/Users/shadowmoon/nonoNangbi/nonoNangbi/docs/V1_RELEASE_CHECKLIST.md)를 사용한다.

## Known limitations

- Mac이 sleep/off 상태면 monitoring이 멈춘다.
- CDP Chrome이 켜져 있어야 한다.
- Codex/Claude login, Turnstile, 수동 인증은 사람이 처리해야 한다.
- 서비스 UI가 바뀌면 parser가 깨질 수 있다.
- SwiftUI app은 로컬 prototype이며 notarized distribution이 아니다.
- Chrome Extension과 always-on infrastructure는 V1에 포함하지 않는다.

자세한 목록은 [KNOWN_LIMITATIONS.md](/Users/shadowmoon/nonoNangbi/nonoNangbi/docs/KNOWN_LIMITATIONS.md)를 본다.

## V1 status

V1은 로컬 Mac에서 1주일 실사용을 시작할 수 있는 release candidate 상태를 목표로 한다.

V1 ready 조건:

- `npm run health`에서 다음 행동이 명확하다.
- `npm run status:json`이 SwiftUI app이 읽을 수 있는 JSON을 출력한다.
- `npm run verify:local:safe`가 실제 Discord 발송 없이 핵심 검사를 수행한다.
- 사용자가 아침 시작, 개발 중 대응, 하루 종료, 주간 리뷰 흐름을 문서만 보고 실행할 수 있다.
