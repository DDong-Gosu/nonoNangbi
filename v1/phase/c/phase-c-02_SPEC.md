# phase-c-02_SPEC.md

## Phase-c-02 — Policy tuning framework + structured status output

## 0. 목적

Phase-c-02의 목적은 Mongi Usage Coach의 알림 정책을 쉽게 조정할 수 있는 구조로 만들고, 향후 SwiftUI macOS 앱이 읽을 수 있는 structured status output을 준비하는 것이다.

현재 Mongi는 다음 기능을 갖고 있다.

- Codex/Claude usage extraction
- usage normalization
- event detection
- Discord notification
- CDP Chrome starter
- launchd monitor automation
- non-disruptive monitoring
- health check
- logs summary
- daily summary
- real-world validation docs

하지만 현재 상태 확인과 정책 조정은 아직 터미널/코드 중심이다.

현재 문제:

1. idle threshold, weekly idle interval, diagnostic interval 같은 정책값이 명확히 한 곳에 정리되어 있지 않다.
2. 알림 카테고리별 on/off가 쉽게 보이지 않는다.
3. quiet hours, message intensity 같은 설정을 한눈에 확인하기 어렵다.
4. SwiftUI 앱을 만들기 전에 앱이 읽을 수 있는 안정적인 JSON 상태 출력이 필요하다.
5. health/daily/log 상태가 사람용 text output 중심이라 앱에서 바로 사용하기 어렵다.

Phase-c-02는 UI를 만들지 않는다.  
대신 향후 SwiftUI 앱이 쉽게 읽을 수 있는 정책/상태 구조를 만든다.

핵심 결과물:

- policy config
- policy check script
- structured status JSON
- daily summary JSON option
- README policy/status 문서화

---

## 1. 제품 방향

Mongi V1의 흐름은 다음이다.

Mac 열기
→ Mongi Start 실행
→ launchd monitor 자동 실행
→ Discord 알림 수신
→ 상태 확인
→ 정책 조정
→ 구독 활용률 리뷰

Phase-c-02는 이 중 “상태 확인”과 “정책 조정”의 내부 기반을 정리한다.

주의:

이 Phase에서 local HTML dashboard를 만들지 않는다.  
SwiftUI 앱도 아직 만들지 않는다.  
먼저 SwiftUI 앱이 가져다 쓸 수 있는 CLI/JSON 기반 상태 모델을 만든다.

---

## 2. 포함 범위

Phase-c-02에 포함되는 작업:

1. policy config 구조 도입
2. policy default 값 정리
3. `npm run policy:check` 추가
4. `npm run status:json` 추가
5. `npm run daily:summary -- --json` 또는 동등한 JSON output 지원
6. status JSON에 health/daily summary/policy 핵심 정보 포함
7. config validation
8. README에 policy/status usage 문서화
9. 기존 CLI 명령 유지

---

## 3. 제외 범위

Phase-c-02에서 하지 않을 것:

- SwiftUI macOS app 개발
- local HTML dashboard 개발
- Chrome Extension 개발
- menu bar app 개발
- 외부 서버/API 개발
- database 추가
- chart UI 추가
- notification policy 대규모 튜닝
- message template 대규모 수정
- parser rewrite
- launchd 구조 변경
- AI-generated report

정책값은 config화하되, 실제 튜닝은 3~5일 사용 데이터가 쌓인 뒤 한다.

---

## 4. 파일 구조 요구사항

생성 또는 수정할 파일:

- `src/policy/defaultPolicy.js`
- `src/policy/policyStore.js`
- `scripts/policy-check.js`
- `scripts/status-json.js`
- `scripts/daily-summary.js`
- `package.json`
- `README.md`

선택 생성:

- `config/policy.example.json`
- `config/policy.json`

권장:

- `config/policy.example.json`은 commit 가능
- `config/policy.json`은 local override 용도
- `config/policy.json`은 `.gitignore`에 추가

기존 파일 중 필요 시 수정:

- `src/config.js`
- `src/events/eventDetector.js`
- `src/notifications/notificationDispatcher.js`
- `src/notifications/messages.js`

단, 기존 behavior를 불필요하게 바꾸지 않는다.

---

## 5. policy config 요구사항

정책 config는 다음 구조를 기본으로 한다.

{
  "notifications": {
    "recoveredShort": true,
    "recoveredWeekly": true,
    "sessionStopped": true,
    "weeklyIdle": true,
    "diagnostics": true
  },
  "thresholds": {
    "sessionStoppedMinutes": 20,
    "weeklyIdleReminderHours": 4,
    "diagnosticReminderHours": 6
  },
  "quietHours": {
    "enabled": true,
    "startHour": 23,
    "endHour": 8
  },
  "message": {
    "intensity": "normal"
  },
  "services": {
    "codex": {
      "enabled": true,
      "weeklyIdleEnabled": true
    },
    "claude": {
      "enabled": true,
      "weeklyIdleEnabled": true
    }
  }
}

허용 message intensity:

- calm
- normal
- firm

기본값은 기존 behavior와 최대한 동일해야 한다.

---

## 6. policyStore 요구사항

`src/policy/policyStore.js`는 다음 기능을 제공한다.

필수 export 예시:

- `loadPolicy()`
- `getDefaultPolicy()`
- `validatePolicy(policy)`
- `mergePolicy(defaultPolicy, localPolicy)`
- `summarizePolicy(policy)`

동작:

1. default policy를 불러온다.
2. `config/policy.json`이 있으면 읽는다.
3. local policy를 default에 merge한다.
4. invalid value가 있으면 warning을 반환한다.
5. secret을 읽거나 출력하지 않는다.

주의:

- `config/policy.json`이 없어도 정상 동작해야 한다.
- JSON parse error가 있으면 친절한 error를 출력해야 한다.
- unknown key는 warning 처리하거나 무시한다.
- message intensity가 허용값 밖이면 warning 처리하고 default 사용한다.
- hour는 0~23 범위여야 한다.
- threshold 값은 양수여야 한다.

---

## 7. policy:check 요구사항

생성 파일:

- `scripts/policy-check.js`

package script:

- `policy:check` -> `node scripts/policy-check.js`

출력 예시:

Current Mongi Policy

Notifications:
- recovered short: enabled
- recovered weekly: enabled
- session stopped: enabled
- weekly idle: enabled
- diagnostics: enabled

Thresholds:
- session stopped: 20 min
- weekly idle reminder: 4 hours
- diagnostic reminder: 6 hours

Quiet hours:
- enabled: yes
- window: 23:00-08:00

Services:
- Codex: enabled, weekly idle enabled
- Claude: enabled, weekly idle enabled

Message:
- intensity: normal

Warnings:
- none

주의:

- Discord Webhook URL 출력 금지
- `.env` full dump 출력 금지
- cookies/session data 출력 금지

---

## 8. status-json 요구사항

생성 파일:

- `scripts/status-json.js`

package script:

- `status:json` -> `node scripts/status-json.js`

목적:

SwiftUI 앱이나 다른 wrapper가 Mongi 상태를 쉽게 읽을 수 있도록 structured JSON을 출력한다.

입력:

- `data/state.json`
- `logs/launchd-out.log`
- `logs/launchd-error.log`
- policy config
- 가능하면 기존 health/daily summary logic

출력 JSON 구조 예시:

{
  "generatedAt": "2026-05-26T12:00:00.000Z",
  "overallStatus": "warning",
  "nextAction": "Open Mongi Start.app because CDP Chrome is unreachable.",
  "health": {
    "envFound": true,
    "discordWebhookConfigured": true,
    "browserMode": "cdp",
    "cdpReachable": false,
    "launchdInstalled": true,
    "launchdLoaded": true,
    "quietHoursActive": false
  },
  "usage": {
    "codex": {
      "shortRemaining": 83,
      "weeklyRemaining": 83,
      "failures": 0,
      "lastCheckedAt": "..."
    },
    "claude": {
      "shortRemaining": 100,
      "weeklyRemaining": 100,
      "failures": 0,
      "lastCheckedAt": "..."
    }
  },
  "today": {
    "runs": 70,
    "successful": 13,
    "failed": 57,
    "notificationsSent": 2,
    "events": {
      "usage_active": 3,
      "session_stopped": 13
    },
    "quietHoursSuppressionHint": true
  },
  "policy": {
    "notifications": {},
    "thresholds": {},
    "quietHours": {},
    "message": {},
    "services": {}
  },
  "warnings": []
}

주의:

- full state dump 출력 금지
- full logs 출력 금지
- Discord Webhook URL 출력 금지
- `.env` 전체 출력 금지
- cookies/session data 출력 금지

---

## 9. overallStatus 판단 기준

`overallStatus`는 다음 중 하나다.

- ok
- warning
- error

권장 기준:

ok:

- CDP reachable yes
- launchd loaded yes
- state found
- latest run exit code 0

warning:

- CDP unreachable
- recent monitor failures high
- usage page missing
- quiet hours suppressing notifications
- parser failures present

error:

- `.env` missing
- state missing and monitor never ran
- launchd not installed/loaded when expected
- repeated parse failures
- invalid policy config that prevents policy loading

정확한 판단은 best-effort로 충분하다.  
중요한 것은 사용자가 다음 행동을 알 수 있어야 한다는 점이다.

---

## 10. nextAction 요구사항

status JSON은 항상 `nextAction`을 포함한다.

예시:

- “Mongi is running normally.”
- “Open Mongi Start.app or run npm run start:chrome because CDP is unreachable.”
- “Confirm Codex/Claude usage pages are open in CDP Chrome.”
- “Run npm run launchd:install because launchd is not loaded.”
- “Review policy config because invalid values were found.”
- “No action needed. Notifications may be quiet because quiet hours are active.”

---

## 11. daily-summary JSON output 요구사항

기존 `scripts/daily-summary.js`에 JSON output option을 추가한다.

허용 방식은 둘 중 하나:

1. `npm run daily:summary -- --json`
2. 별도 script `npm run daily:summary:json`

권장:

- `npm run daily:summary -- --json`

JSON output에는 최소 다음 포함:

- date
- runs
- successful
- failed
- latestRun
- latestExitCode
- usage summary
- events summary
- notificationsSent
- quietHoursSuppressionHint
- recentErrorsCount
- reviewQuestions

주의:

기존 text output은 유지한다.  
기존 `npm run daily:summary`가 깨지면 안 된다.

---

## 12. 기존 event/notification policy 연결

Phase-c-02에서 policy config를 도입하되, 기존 behavior가 갑자기 바뀌면 안 된다.

가능하면 다음 단계로 연결한다.

1. policy config를 읽는다.
2. notification dispatcher 또는 event detector에서 해당 policy를 참고한다.
3. notification category가 disabled면 알림을 보내지 않는다.
4. threshold 값은 policy에서 가져온다.
5. missing/invalid policy는 default 사용한다.

주의:

이 작업이 너무 크면 Phase-c-02에서는 read-only policy summary까지만 구현하고, actual enforcement는 Phase-c-02b로 분리한다.

단, 가능하다면 최소한 다음은 반영한다.

- quiet hours config
- weekly idle reminder interval
- diagnostic reminder interval
- session stopped minutes

기존 tests가 깨지면 안 된다.

---

## 13. README 업데이트 요구사항

README에 다음 섹션 추가 또는 수정.

### Policy configuration

포함:

- `config/policy.example.json`
- local override로 `config/policy.json` 사용
- `npm run policy:check`
- 각 설정 의미
- 기본값 설명
- invalid config 처리 방식

### Structured status output

포함:

- `npm run status:json`
- SwiftUI 앱에서 이 JSON을 읽을 수 있다는 점
- secrets/full logs를 출력하지 않는다는 점
- `overallStatus`와 `nextAction` 설명

### Daily summary JSON

포함:

- `npm run daily:summary`
- `npm run daily:summary -- --json`

### Future SwiftUI app

포함:

- SwiftUI 앱은 이 structured status output을 읽는 wrapper로 시작할 수 있음
- Phase-d-01에서 다룰 예정

---

## 14. 검증 명령

Agent는 작업 후 아래 명령을 실행한다.

Syntax:

node -c src/policy/defaultPolicy.js
node -c src/policy/policyStore.js
node -c scripts/policy-check.js
node -c scripts/status-json.js
node -c scripts/daily-summary.js

Command validation:

npm run policy:check
npm run status:json
npm run daily:summary
npm run daily:summary -- --json
npm run health
npm run logs:summary
npm run test:state
npm run test:scenarios

JSON validation:

- `npm run status:json` output이 valid JSON인지 확인
- `npm run daily:summary -- --json` output이 valid JSON인지 확인

Security check:

- status JSON에 Discord Webhook URL이 없는지 확인
- status JSON에 `.env` full dump가 없는지 확인
- status JSON에 full logs가 없는지 확인

---

## 15. 성공 기준

Phase-c-02 완료 조건:

1. `npm run policy:check`가 동작한다.
2. policy default와 local override 구조가 있다.
3. invalid policy value에 대해 warning을 제공한다.
4. `npm run status:json`이 valid JSON을 출력한다.
5. status JSON에 health, usage, today summary, policy, nextAction이 포함된다.
6. `npm run daily:summary -- --json`이 동작한다.
7. 기존 text daily summary가 깨지지 않는다.
8. 기존 health/log/test 명령이 깨지지 않는다.
9. README에 policy/status JSON 사용법이 문서화되어 있다.
10. secrets/full logs/full state를 출력하지 않는다.

---

## 16. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-c-02 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Policy result
- default policy created yes/no
- local override supported yes/no
- policy:check output summary

6. Structured status result
- status:json valid yes/no
- included sections
- nextAction example

7. Daily summary JSON result
- JSON mode works yes/no

8. Security checks
- webhook exposed no
- env dump exposed no
- full logs exposed no

9. Remaining risks
- ...

10. Next recommended phase
- Phase-c-03 — Subscription value review + monthly decision framework

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full logs를 붙이지 말 것.
- full state dump를 붙이지 말 것.

---

## 17. 핵심 판단

Phase-c-02는 UI를 만드는 단계가 아니다.

이 단계의 핵심은 향후 SwiftUI 앱이 사용할 수 있는 안정적인 데이터 계약을 만드는 것이다.

즉, Phase-c-02의 산출물은 다음이다.

- 현재 정책을 볼 수 있음
- 정책을 local config로 override할 수 있음
- 현재 상태를 JSON으로 읽을 수 있음
- daily summary도 JSON으로 읽을 수 있음
- SwiftUI 앱이 이 출력들을 화면에 표시할 수 있음

이 작업을 먼저 해두면 Phase-d-01 SwiftUI 앱은 훨씬 작고 명확해진다.