# phase-a-03_SPEC.md

## Phase-a-03 — Usage normalization + event detection + Mongi notification engine

## 0. 목적

Phase-a-03의 목적은 Mongi Usage Coach가 단순히 Codex/Claude usage percent를 읽는 수준을 넘어, 실제로 행동을 유도하는 알림 엔진으로 작동하게 만드는 것이다.

이 Phase는 다음을 하나의 큰 작업 단위로 포함한다.

1. Codex/Claude usage percent 의미 정규화
2. remainingPercent 기준 통일
3. usage 변화 기반 event detection
4. Discord 알림 발송
5. 몽이 랜덤 메시지 시스템
6. 중복/스팸 방지
7. mock scenario 검증

이 단계가 끝나면 `npm run monitor`를 반복 실행했을 때 다음 이벤트가 실제로 판단되어 Discord로 알림이 가야 한다.

- short-window 100% 회복
- weekly 100% 회복
- 사용 중 상태 감지 및 무알림
- 20분 무변화 후 session stopped 요약
- weekly 100% 방치 리마인드
- CDP/파싱 실패 diagnostic rate-limited 알림

---

## 1. 현재 상태

Phase-a-01 완료:

- config
- stateStore
- logger
- Discord Webhook
- message scaffold
- smoke tests

Phase-a-02 완료:

- Playwright 설치
- CDP Chrome 연결
- Codex/Claude usage page extraction
- service-specific parser
- monitor state update
- diagnostic artifacts

Phase-a-02-fix 완료:

- 일반 Chrome CDP 연결 성공
- Codex/Claude extraction 성공
- Codex/Claude parsing 성공
- Discord Webhook 성공

현재 확인된 중요한 문제:

- Codex와 Claude의 percent 의미가 다르다.
- Codex는 remaining/recovered capacity 방향으로 해석된다.
- Claude는 화면에서 `0% 사용됨`처럼 used percent 방향으로 노출된다.
- 따라서 event detection은 raw percent가 아니라 normalized remaining percent 기준으로 해야 한다.

---

## 2. 포함 범위

Phase-a-03에 포함되는 작업:

1. Parser result normalization 확장
2. State schema 확장
3. 기존 state migration 또는 backward compatibility
4. Event detector 구현
5. Mongi message templates 확장
6. Discord event notification 연결
7. Quiet hours 적용
8. Duplicate notification prevention
9. Parse/CDP failure diagnostic rate limit
10. Mock scenario runner 작성
11. README 업데이트
12. 실제 `npm run monitor` 검증

---

## 3. 제외 범위

Phase-a-03에서 하지 않을 것:

- launchd 자동 실행
- CDP Chrome 자동 시작 버튼
- macOS 앱 패키징
- Chrome Extension
- VPS 이전
- 웹 대시보드
- 데이터베이스
- AI API 기반 실시간 메시지 생성
- OCR
- captcha/Turnstile 우회

자동 실행과 “딸깍 버튼”은 Phase-b에서 다룬다.

---

## 4. 핵심 개념: remainingPercent

모든 이벤트 판단은 canonical remaining percent 기준으로 한다.

정의:

- `remainingPercent = 100`: 완전히 사용 가능
- `remainingPercent = 0`: 사용 가능량 없음
- 사용하면 remainingPercent는 감소한다.
- 시간이 지나 회복되면 remainingPercent는 증가한다.

서비스별 변환:

Codex:

- raw percent가 remaining/recovered capacity라면
- remainingPercent = rawPercent

Claude:

- raw percent가 used percent라면
- remainingPercent = 100 - rawPercent

예시:

Codex 화면/파서:

- raw short = 66
- raw meaning = remaining
- remaining short = 66

Claude 화면/파서:

- raw short = 0
- raw meaning = used
- remaining short = 100

---

## 5. State schema 요구사항

각 service state는 기존 필드를 유지하면서 normalized field를 추가한다.

필수 필드:

- shortWindowPercent
- weeklyPercent
- lastShortWindowPercent
- lastWeeklyPercent

추가 필드:

- rawShortWindowPercent
- rawWeeklyPercent
- rawShortWindowMeaning
- rawWeeklyPercentMeaning
- remainingShortWindowPercent
- remainingWeeklyPercent
- lastRemainingShortWindowPercent
- lastRemainingWeeklyPercent

Allowed meaning values:

- remaining
- used
- unknown

기존 필드 호환성:

- 기존 `shortWindowPercent`, `weeklyPercent`는 당장 삭제하지 않는다.
- 가능하면 legacy alias처럼 유지한다.
- 하지만 event detection은 반드시 `remainingShortWindowPercent`, `remainingWeeklyPercent`를 사용한다.

Migration rule:

- 기존 state에 normalized field가 없으면 자동으로 추가한다.
- 기존 percent 값만 있고 meaning을 모르면 `unknown`으로 둔다.
- parser가 새 값을 성공적으로 반환하면 normalized fields를 갱신한다.

---

## 6. Parser result 요구사항

Parser normalized result는 다음 필드를 포함해야 한다.

- serviceKey
- serviceName
- ok
- shortWindowPercent
- weeklyPercent
- rawShortWindowPercent
- rawWeeklyPercent
- rawShortWindowMeaning
- rawWeeklyPercentMeaning
- remainingShortWindowPercent
- remainingWeeklyPercent
- parseMethod
- parseConfidence
- rawTextSample
- parsedAt
- errorReason

Codex parser:

- remaining 방향으로 확인되면 raw meaning = remaining
- remaining percent = raw percent

Claude parser:

- `0% used`, `0% 사용됨`, 또는 equivalent label이 확인되면 raw meaning = used
- remaining percent = 100 - raw percent

주의:

- meaning을 확신하지 못하면 confidence를 낮추고 meaning unknown 처리한다.
- unknown meaning일 때 high confidence를 주지 않는다.
- null 값으로 기존 valid state를 덮어쓰지 않는다.

---

## 7. Event detection 요구사항

새 모듈 권장:

- `src/events/eventDetector.js`

입력:

- previous service state
- current service state
- config
- current time

출력:

- event objects array

Event object 예시:

{
  type: "recovered_short",
  serviceKey: "codex",
  serviceName: "Codex",
  remainingShortWindowPercent: 100,
  remainingWeeklyPercent: 95,
  occurredAt: "..."
}

필수 event types:

- `recovered_short`
- `recovered_weekly`
- `usage_active`
- `session_stopped`
- `weekly_idle`
- `parse_failure_digest`
- `cdp_unreachable_digest`

주의:

- `usage_active`는 내부 상태 판단용이며 Discord 알림을 보내지 않는다.
- Discord 알림은 recovered/session_stopped/weekly_idle/diagnostic digest에만 보낸다.

---

## 8. Event logic

## 8.1 Usage active

조건:

- current remaining short < previous remaining short
- 또는 current remaining weekly < previous remaining weekly

의미:

- 사용자가 사용 중이다.
- 알림을 보내지 않는다.
- `lastChangedAt` 갱신
- `sessionSummarySent = false`

주의:

- Claude raw used percent 증가도 normalized remaining 감소로 표현되어야 한다.

---

## 8.2 Recovered short

조건:

- previous remaining short < 100
- current remaining short === 100

동작:

- Discord recovered short 메시지 전송
- `lastShortRecoveredAt` 갱신
- 중복 발송 방지

---

## 8.3 Recovered weekly

조건:

- previous remaining weekly < 100
- current remaining weekly === 100

동작:

- Discord recovered weekly 메시지 전송
- `lastWeeklyRecoveredAt` 갱신
- 중복 발송 방지

---

## 8.4 Session stopped

조건:

- 이전에 usage active가 있었음
- 마지막 사용량 변화 이후 `IDLE_MINUTES_BEFORE_SUMMARY` 이상 지남
- 현재 remaining 값이 직전 체크와 동일
- `sessionSummarySent === false`

동작:

- Discord session stopped 메시지 전송
- 현재 remaining short/weekly 포함
- `sessionSummarySent = true`

기본값:

- idle threshold = 20분

---

## 8.5 Weekly idle

조건:

- current remaining weekly === 100
- 마지막 weekly idle reminder 이후 `WEEKLY_FULL_REMINDER_HOURS` 이상 지남
- quiet hours가 아님
- parse success 상태

동작:

- Discord weekly idle 메시지 전송
- `lastWeeklyFullReminderAt` 갱신

주의:

- weekly 100%는 “아껴둔 것”이 아니라 “아직 결제분을 산출물로 바꾸지 못한 것”으로 메시징한다.
- 단, 너무 자책시키는 톤은 금지한다.

---

## 8.6 Diagnostic digest

CDP 연결 실패, login required, parser failure가 반복되면 rate-limited diagnostic 알림을 보낸다.

조건 예시:

- `consecutiveParseFailures >= 3`
- 마지막 diagnostic 알림 이후 6시간 이상 지남

동작:

- Discord에 짧은 diagnostic 메시지 전송
- 원인과 다음 action 포함

예시:

“몽 진단. Claude 사용량을 계속 못 읽고 있어. Chrome CDP가 꺼졌거나 로그인 세션이 풀렸을 가능성이 큼. Chrome을 CDP 모드로 열고 usage page를 확인해줘.”

필수:

- 매 monitor run마다 diagnostic을 보내면 안 된다.

---

## 9. Quiet hours

기본값:

- 23:00 ~ 08:00

Quiet hours 중:

- normal event Discord 알림은 보내지 않는다.
- state update는 계속 한다.
- logs는 남긴다.

선택 정책:

- suppressed event를 나중에 보낼지 여부는 v1에서는 구현하지 않는다.
- 단순히 quiet hours 동안은 알림을 보내지 않는다.

---

## 10. Message system 요구사항

`src/notifications/messages.js`를 확장한다.

필수 categories:

- recoveredShort
- recoveredWeekly
- sessionStopped
- weeklyIdle
- parseFailureDigest
- cdpUnreachableDigest

최소 템플릿 수:

- recoveredShort: 15개
- recoveredWeekly: 15개
- sessionStopped: 15개
- weeklyIdle: 25개
- parseFailureDigest: 5개
- cdpUnreachableDigest: 5개

템플릿 변수:

- serviceName
- remainingShortWindowPercent
- remainingWeeklyPercent
- rawShortWindowPercent
- rawWeeklyPercent
- idleMinutes
- reminderHours
- suggestedAction
- time
- date

메시지 톤:

- DESIGN.md를 따른다.
- “몽!”은 가볍게 사용한다.
- 과한 캐릭터 말투 금지.
- 모든 메시지는 작은 next action을 포함한다.

---

## 11. Notification dispatcher

새 모듈 권장:

- `src/notifications/notificationDispatcher.js`

역할:

1. event object를 받는다.
2. quiet hours 여부 확인
3. event type에 맞는 message 생성
4. Discord Webhook 전송
5. state의 notification timestamp 갱신에 필요한 patch 반환

주의:

- eventDetector와 Discord 전송을 너무 강하게 결합하지 않는다.
- scenario test에서는 Discord를 실제로 보내지 않고 dry-run 가능해야 한다.

---

## 12. Monitor 통합 요구사항

`src/monitor.js`는 Phase-a-03에서 full local monitor가 된다.

동작 순서:

1. config 로드
2. state 로드 및 migration
3. CDP 또는 persistent browser context 연결
4. 각 service extraction + parsing
5. previous state snapshot 보관
6. current state 업데이트
7. normalized remaining fields 반영
8. event detection
9. notification dispatch
10. state 저장
11. summary log 출력

주의:

- 한 service 실패가 전체 run을 중단시키면 안 된다.
- Discord 전송 실패도 전체 state 저장을 막으면 안 된다.
- 단, 실패는 명확히 로그에 남긴다.

---

## 13. Scenario test 요구사항

새 script 권장:

- `scripts/test-scenarios.js`

npm script:

- `test:scenarios`

목적:

실제 Codex/Claude usage가 변하기를 기다리지 않고 event detection을 검증한다.

필수 scenarios:

1. Codex recovered short
2. Codex recovered weekly
3. Claude used percent 증가 -> remaining 감소 -> usage active, no notification
4. Session stopped after idle threshold
5. Weekly idle reminder
6. Weekly idle duplicate prevention
7. Quiet hours suppression
8. Parse failure digest rate limit
9. Null parse result does not erase previous valid state

Scenario test는 실제 Discord를 보내지 않는다.

Dry-run dispatcher 또는 mock send function을 사용한다.

성공 기준:

- expected event count/type이 맞다.
- usage_active는 Discord notification 대상이 아니다.
- 중복 알림이 방지된다.
- Claude normalization이 올바르다.

---

## 14. README 업데이트

README에 다음을 추가한다.

- Codex/Claude percent semantic difference
- remainingPercent 기준 설명
- Phase-a-03 event types
- `npm run test:scenarios`
- `npm run monitor`
- quiet hours
- weekly idle reminder 의미
- CDP Chrome이 꺼져 있을 때 diagnostic이 올 수 있다는 점
- 자동 실행/딸깍 버튼은 Phase-b에서 다룬다는 점

---

## 15. Agent 판단권

Agent는 다음을 스스로 판단할 수 있다.

- state migration 구현 방식
- eventDetector function 구조
- notification dispatcher 구조
- scenario test 방식
- message template 문구
- exact diagnostic rate limit field names
- legacy percent field compatibility 처리 방식

단, 다음은 반드시 지켜야 한다.

- Event detection은 normalized remaining percent 기준
- Claude raw used percent는 remaining으로 변환
- 사용 중일 때는 Discord 알림 금지
- 중복 알림 방지
- scenario test 구현
- 실제 Discord smoke test 유지
- Chrome Extension 구현 금지
- launchd 구현 금지

---

## 16. 검증 명령

Agent는 작업 후 최소 아래 명령을 실행한다.

npm run test:state
npm run test:discord
npm run test:scenarios
npm run debug:page-text
npm run monitor

Syntax checks:

node -c src/events/eventDetector.js
node -c src/notifications/notificationDispatcher.js
node -c src/notifications/messages.js
node -c src/monitor.js
node -c scripts/test-scenarios.js

추가로 변경된 parser/state/config 파일도 syntax check한다.

---

## 17. 성공 기준

Phase-a-03 완료 조건:

1. Codex/Claude percent 의미가 normalized remaining percent로 통일된다.
2. Claude `0% used`가 remaining 100으로 해석된다.
3. Event detection이 remaining percent 기준으로 작동한다.
4. recovered_short 이벤트가 작동한다.
5. recovered_weekly 이벤트가 작동한다.
6. usage_active 상태에서는 Discord 알림이 없다.
7. session_stopped 이벤트가 작동한다.
8. weekly_idle 이벤트가 작동한다.
9. diagnostic digest가 rate-limited 된다.
10. quiet hours가 적용된다.
11. 몽이 랜덤 메시지가 상황별로 생성된다.
12. `npm run test:scenarios`가 통과한다.
13. `npm run monitor`가 실제 CDP extraction 결과를 기반으로 state를 업데이트하고 필요한 알림을 보낸다.
14. README가 업데이트된다.

---

## 18. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-a-03 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Normalization results
- Codex raw/meaning/remaining
- Claude raw/meaning/remaining

6. Event scenario results
- ...

7. Live monitor result
- ...

8. Discord notification result
- ...

9. Manual verification
- ...

10. Next recommended phase
- Phase-b — Local automation, launchd, and one-click CDP Chrome starter

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full page text를 보고하지 말 것.
- full logs를 불필요하게 붙이지 말 것.

---

## 19. 핵심 판단

Phase-a-03은 Mongi Usage Coach가 실제 “코치”가 되는 단계다.

Phase-a-02까지는 사용량을 읽을 수 있는지 확인했다.  
Phase-a-03에서는 그 사용량을 행동 트리거로 바꾼다.

이 단계에서 중요한 것은 알림을 많이 보내는 것이 아니다.

중요한 것은:

- 사용할 때는 조용히 있고
- 멈췄을 때 요약하고
- 회복됐을 때 다시 시작하게 만들고
- 주간 사용량이 방치될 때 돈이 새고 있음을 알려주는 것

Mongi는 감시자가 아니라 실행을 돕는 장치다.