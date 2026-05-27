# Mongi Usage Coach

## 목차

- Mongi란
- V2 output status
- V1 구조
- Quick start
- Daily workflow
- SwiftUI/menu bar app
- V2 usage semantics
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
- `data/state.json` 파일 기반 상태
- `logs/` 파일 기반 실행 로그
- Discord Webhook 알림
- SwiftUI macOS wrapper와 menu bar 상태 표시

V1은 SaaS, 웹 대시보드, 데이터베이스, 외부 서버 없이 동작한다.

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
npm run package:app
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
- menu bar popover는 output status를 한국어 label로 보여주고, Codex/Claude remaining을 각각 compact gauge bar 두 개로 보여줌 (5시간/주간, 세션/전체)
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

Popover의 usage 요약은 provider 별로 두 개의 compact gauge bar로 remaining을 표시한다. 예: Codex `5시간 99% 남음`, `주간 69% 남음`. Claude `세션 33% 남음`, `전체 96% 남음`.

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
