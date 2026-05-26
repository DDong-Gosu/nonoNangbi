# Mongi Usage Coach

## 목차

- Mongi란
- V1 구조
- Quick start
- Daily workflow
- SwiftUI/menu bar app
- Safe verification
- Important commands
- Troubleshooting
- Docs
- Known limitations
- V1 status

## Mongi란

Mongi Usage Coach는 Codex와 Claude 유료 사용량이 실제 개발 산출물로 이어지도록 돕는 개인용 로컬 코치다.

Mongi는 Codex/Claude usage page를 주기적으로 읽고, 사용량 회복, 주간 방치, 세션 멈춤, 진단 실패를 감지해 필요한 경우 Discord로 작은 다음 행동을 알려준다.

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

앱 빌드:

```bash
npm run build:app
```

앱 열기:

```bash
npm run open:app
```

앱에서 가능한 작업:

- 상태 새로고침: `npm run status:json`
- CDP Chrome 시작: `npm run start:chrome`
- health 확인: `npm run health`
- Daily Summary 확인: `npm run daily:summary`
- Value Review 확인: `npm run value:review`
- project root 선택 또는 reset

앱은 Node core를 재작성하지 않는다. 기존 npm scripts를 실행하고 결과를 보여주는 로컬 wrapper다.

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
