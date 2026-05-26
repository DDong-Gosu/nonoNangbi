# MVP_SPEC.md

## 목차

- 제품 목적
- V1 범위
- 완료된 phase 요약
- 현재 구조
- Local Mac-only 결정
- CDP-based monitoring 결정
- SwiftUI/menu bar wrapper
- Safe verification
- Status JSON contract
- Subscription value review
- 알림 정책
- 상태와 보안
- Known limitations
- Non-goals
- V1 완료 기준

## 제품 목적

Mongi Usage Coach는 사용자가 결제한 Codex와 Claude 구독을 실제 개발 산출물로 바꾸도록 돕는 개인용 usage coach다.

목표는 사용량을 많이 쓰게 만드는 것이 아니라, 사용량 회복과 방치 신호를 개발 행동으로 연결하는 것이다.

Mongi는 사용자를 혼내는 제품이 아니다. 몽이는 조용하지만 단호하게 “지금 작은 작업 하나를 닫자”는 다음 행동을 알려준다.

## V1 범위

V1은 한 명의 사용자가 자기 Mac에서 쓰는 로컬 자동화다.

포함:

- Codex/Claude usage page 접근
- Codex/Claude parser 분리
- remaining percent 정규화
- event detection
- Discord Webhook notification
- quiet hours
- file-based state
- launchd scheduled monitor
- health/status/log summary
- safe local verification
- policy config
- daily summary
- subscription value review
- SwiftUI macOS wrapper
- menu bar status
- Chrome Extension feasibility review
- always-on environment review

## 완료된 phase 요약

- Phase A: 환경변수, Discord smoke test, 기본 monitor scaffold, state 저장, 메시지 tone 기반 구축
- Phase B: CDP Chrome 연결, usage page extraction, 서비스별 parser, remaining percent 정규화, event detection, scenario test
- Phase C: launchd 자동화, non-disruptive monitoring, health/log summary, real-world validation 문서
- Phase D: policy config, structured status JSON, daily summary, value review, SwiftUI app, menu bar access, Chrome Extension/always-on feasibility review
- Phase E: V1 release candidate 문서 정리, 운영 가이드, troubleshooting, command reference, known limitations, final validation

## 현재 구조

```text
Mac
  launchd
    npm run monitor
      src/monitor.js
        usageExtractor
          Chrome CDP
            Codex usage page
            Claude usage page
        codexParser / claudeParser
        eventDetector
        notificationDispatcher
        stateStore
  data/state.json
  logs/launchd-out.log
  logs/launchd-error.log
  SwiftUI app / MenuBarExtra
    npm run status:json
    npm run start:chrome
    npm run health
    npm run daily:summary
    npm run value:review
```

## Local Mac-only 결정

V1은 Local Mac-only로 간다.

이유:

- 사용자의 실제 개발 환경과 로그인 세션이 같은 Mac에 있다.
- Codex/Claude usage page는 인증된 브라우저 세션과 수동 인증이 필요할 수 있다.
- 외부 서버는 session, Turnstile, cookie, secret 관리 위험을 키운다.
- 추가 인프라 비용이 제품 목적과 맞지 않는다.

Mac이 잠자기 상태거나 꺼져 있으면 monitoring이 멈추는 것은 V1의 알려진 제한이다.

## CDP-based monitoring 결정

V1은 Chrome CDP를 사용한다.

기본 흐름:

1. `npm run start:chrome` 또는 SwiftUI app의 `Start Mongi`로 CDP Chrome을 연다.
2. Codex/Claude usage page를 같은 Chrome profile에서 직접 로그인한다.
3. launchd가 `npm run monitor`를 10분마다 실행한다.
4. monitor는 기존 usage tab을 재사용하고 가능한 한 focus를 방해하지 않는다.

CDP가 unreachable이면 monitor는 실패를 진단으로 남긴다. 이 상태는 `npm run health`, `npm run status:json`, SwiftUI app에서 확인한다.

## SwiftUI/menu bar wrapper

SwiftUI app은 Node core를 대체하지 않는다.

역할:

- `status:json` 결과 표시
- CDP reachable, launchd loaded, quiet hours, next action 표시
- Codex/Claude remaining percent 표시
- 오늘 실행 수, 실패 수, event, notification 요약 표시
- `Start Mongi`, `Health Check`, `Daily Summary`, `Value Review` 실행
- menu bar에서 빠른 상태 확인
- project root 선택과 reset

앱은 로컬 prototype이다. V1에는 notarization, App Store packaging, launchd install/uninstall UI, policy editing UI가 없다.

## Safe verification

`npm run verify:local:safe`는 V1의 안전 검증 명령이다.

역할:

- 실제 Discord message를 보내지 않는다.
- `.env`와 필수 파일 상태를 확인한다.
- CDP 상태를 확인한다.
- policy, status JSON, summary류 명령을 확인한다.
- launchd 상태와 로그 요약을 확인한다.

CDP-dependent checks는 CDP Chrome이 켜져 있어야 통과한다.

`npm run test:discord`는 실제 Discord 메시지를 보내므로 safe verification에 포함하지 않는다.

## Status JSON contract

`npm run status:json`은 SwiftUI app과 로컬 자동화가 읽는 machine-readable contract다.

출력은 JSON만 포함한다.

주요 필드:

- `generatedAt`: 상태 생성 시각
- `overallStatus`: `ok`, `warning`, `error`
- `nextAction`: 사용자가 지금 할 다음 행동
- `health.envFound`: `.env` 존재 여부
- `health.discordWebhookConfigured`: Webhook 설정 여부
- `health.browserMode`: browser connection mode
- `health.cdpReachable`: CDP 연결 가능 여부
- `health.launchdInstalled`: launchd plist 설치 여부
- `health.launchdLoaded`: launchd load 여부
- `health.quietHoursActive`: quiet hours 적용 여부
- `usage.codex`: Codex remaining, failures, lastCheckedAt
- `usage.claude`: Claude remaining, failures, lastCheckedAt
- `today`: 오늘 monitor runs, 성공/실패, event, notification, latest exit code
- `policy`: 적용된 policy summary
- `warnings`: 현재 조치가 필요한 warning/error
- `historyWarnings`: 현재는 회복됐지만 오늘 있었던 과거 실패
- `statusMeta`: recent/stale window와 최근 실패 metadata

포함하지 않는 것:

- Discord Webhook URL
- `.env` 전체 내용
- cookie
- browser session data
- full raw state
- full logs

## Subscription value review

`npm run value:review`는 사용량이 산출물로 바뀌었는지 점검하는 리뷰 도구다.

이 명령은 금융 조언이나 자동 해지 판단이 아니다.

역할:

- monitor reliability 요약
- usage snapshot 요약
- event/notification 요약
- Codex 역할 질문
- Claude 역할 질문
- weekly/monthly review 질문
- `keep`, `keep_but_adjust`, `pause_or_downgrade`, `cancel` decision option 제공

실제 산출물 기록은 `docs/WEEKLY_OUTPUT_TEMPLATE.md`, `docs/MONTHLY_REVIEW_TEMPLATE.md`에 사용자가 직접 남긴다.

## 알림 정책

Discord 알림 대상 event:

- `recovered_short`
- `recovered_weekly`
- `session_stopped`
- `weekly_idle`
- `parse_failure_digest`
- `cdp_unreachable_digest`

중복 방지:

- recovery는 이전 percent가 100 미만이고 현재 100일 때만 보낸다.
- session stopped는 사용 세션당 한 번만 보낸다.
- weekly idle은 policy interval 이후에만 반복한다.
- diagnostic digest는 rate limit을 적용한다.

Quiet hours 기본값은 23:00-08:00 local time이다. 이 시간에는 정상 알림을 보내지 않지만 monitor, state update, log write는 계속한다.

## 상태와 보안

상태는 file-based다.

- `data/state.json`: monitor 상태
- `logs/`: launchd wrapper와 monitor 로그
- `config/policy.json`: local policy override

보안 규칙:

- Discord Webhook URL은 환경변수에서만 읽는다.
- `.env`, `browser-profile/`, `logs/`, `data/state.json`은 commit하지 않는다.
- `.env.example`에는 빈 placeholder만 둔다.
- cookie, session data, Playwright profile은 문서나 Git에 남기지 않는다.

## Known limitations

- Mac sleep/off 중에는 monitoring이 멈춘다.
- CDP Chrome이 실행 중이어야 한다.
- usage page는 수동 login, Turnstile, manual verification이 필요할 수 있다.
- Codex/Claude UI가 바뀌면 parser가 깨질 수 있다.
- status warning에는 과거 실패가 섞일 수 있으므로 `historyWarnings`와 최신 상태를 함께 본다.
- SwiftUI app은 로컬 prototype이다.
- multi-device tracking은 없다.
- cloud sync는 없다.
- Chrome Extension은 V1에 없다.
- always-on infrastructure는 V1에 없다.

## Non-goals

V1에서 하지 않는다:

- Chrome Extension 구현
- always-on server 구축
- policy editing UI
- launchd install/uninstall UI in SwiftUI
- database
- web dashboard
- auth system
- external server
- AI-generated report
- parser rewrite
- App Store packaging
- notarization
- SaaS architecture
- multi-user support

## V1 완료 기준

V1은 다음 조건을 만족하면 complete다.

- 사용자가 README와 docs index만 보고 아침 시작, 하루 종료, 주간 리뷰를 실행할 수 있다.
- `npm run status:json`이 JSON contract를 지킨다.
- `npm run health`가 현재 문제와 다음 행동을 보여준다.
- `npm run verify:local:safe`가 실제 Discord 발송 없이 안전 검증을 수행한다.
- SwiftUI app과 menu bar가 상태 확인과 `Start Mongi` 진입점을 제공한다.
- command reference가 Discord 발송 가능 명령을 명확히 구분한다.
- troubleshooting이 CDP, launchd, usage page, quiet hours, SwiftUI app 문제를 다룬다.
- known limitations와 non-goals가 V1 범위를 명확히 닫는다.
