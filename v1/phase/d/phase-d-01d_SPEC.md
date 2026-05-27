# phase-d-01d_SPEC.md

## Phase-d-01d — V1 app hardening: status accuracy, safe verification, local app install

## 0. 목적

Phase-d-01d의 목적은 Mongi Usage Coach V1을 실제로 매일 사용할 수 있도록 마지막 앱 안정화 작업을 수행하는 것이다.

지금까지 Mongi는 다음을 갖췄다.

- Codex/Claude usage extraction
- usage normalization
- event detection
- Discord notification
- CDP Chrome starter
- launchd automation
- health/log/daily summary
- policy config
- structured status JSON
- subscription value review
- SwiftUI macOS app prototype
- SwiftUI usability polish
- menu bar access
- Chrome Extension feasibility research

현재 남은 V1 마감 전 핵심 문제는 세 가지다.

1. 현재 상태는 정상인데 과거 실패 이력 때문에 앱이 계속 warning으로 보일 수 있다.
2. 검증/테스트 중 실제 Discord 알림이 발송될 수 있어 반복 검증이 부담스럽다.
3. SwiftUI 앱이 아직 Swift Package/Xcode 실행 중심이라, 매일 쓰는 `.app` workflow가 부족하다.

이 Phase는 위 세 가지를 하나의 V1 hardening 작업으로 묶어 해결한다.

---

## 1. 포함 범위

Phase-d-01d에 포함되는 작업:

### 1.1 Status severity calibration

- `status:json`의 `overallStatus` 판단 로직 개선
- 현재 상태와 과거 실패 이력 분리
- stale failure handling 도입
- latest healthy run 기준 도입
- `nextAction` 문구 개선
- SwiftUI/menu bar에서 status가 과민하게 warning으로 남지 않게 조정

### 1.2 Safe verification / dry-run notification mode

- Discord 실발송 없는 안전 검증 모드 추가
- dry-run notification mode 추가
- `verify:local:safe` script 추가
- `test:discord`는 명시적으로만 실행되게 유지
- monitor/dispatcher가 dry-run mode에서 “would send”를 출력할 수 있게 함

### 1.3 Local `.app` build/install workflow

- Swift Package 기반 Mongi 앱을 로컬 `.app`처럼 실행하는 방법 정리
- 가능하면 build/install script 추가
- Dock/Desktop/Applications 사용 루틴 문서화
- README에 daily app usage 추가
- 앱 실행 접근성을 개선

---

## 2. 제외 범위

Phase-d-01d에서 하지 않을 것:

- Chrome Extension 구현
- Always-on 서버 구현
- App Store 배포
- notarization
- advanced code signing
- menu bar 기능 대규모 확장
- policy editing UI
- launchd install/uninstall UI
- database
- external server
- AI-generated reports
- parser rewrite
- event policy 대규모 변경

이 Phase는 V1 안정화 작업이다.  
새로운 큰 기능을 추가하지 않는다.

---

## 3. Status severity calibration 요구사항

현재 문제:

- 오늘 CDP unreachable 실패가 많았음
- 이후 Start Mongi로 정상화됨
- latest monitor run은 healthy
- 그런데 `status:json`의 `overallStatus`가 warning으로 남음
- SwiftUI/menu bar가 계속 경고 상태처럼 보임

이 문제를 해결한다.

### 3.1 현재 상태와 이력 분리

`status:json`에 다음 개념을 도입한다.

- current health
- historical warnings
- recent failures
- stale failures

권장 JSON 필드:

{
  "overallStatus": "ok",
  "currentStatus": "ok",
  "historyStatus": "warning",
  "nextAction": "Mongi is currently healthy. Earlier CDP failures were detected today.",
  "historyWarnings": [
    "Earlier monitor failures were detected today."
  ]
}

단, 기존 SwiftUI app이 깨지지 않도록 기존 필드는 유지한다.

필수 유지:

- `overallStatus`
- `nextAction`
- `health`
- `usage`
- `today`
- `policy`
- `warnings`

새 필드는 추가만 한다.

---

### 3.2 overallStatus 판단 기준 개선

권장 판단:

### error

다음 경우 error:

- `.env` missing
- policy config invalid and cannot load
- state missing and no monitor history
- launchd expected but missing/loaded no
- latest run failed due fatal local config issue

### warning

다음 경우 warning:

- CDP currently unreachable
- latest run exit code nonzero
- latest successful run is too old
- current parser failures are active
- usage page currently missing
- invalid policy values detected but defaults used
- repeated recent failures within recent window

### ok

다음 경우 ok:

- latest run exit code 0
- CDP reachable
- launchd loaded
- state exists
- parser failures are 0 or stable
- old failures exist but current state is healthy

### history warning

다음 경우 overallStatus는 ok 또는 warning 중 정책적으로 결정하되, history warning은 별도 표시:

- 오늘 failed count가 많지만 latest run is healthy
- CDP failure가 과거에 있었지만 현재 reachable
- quiet hours 때문에 알림 suppress 이력이 있지만 현재 문제 아님

권장:

- 현재 healthy면 `overallStatus: ok`
- `historyWarnings`에 과거 이력 표시

---

### 3.3 recent window 기준

기본값:

- recent window: 30 minutes
- stale window: 60 minutes

권장 필드:

{
  "statusMeta": {
    "recentWindowMinutes": 30,
    "staleWindowMinutes": 60,
    "latestRunHealthy": true,
    "latestFailureAgeMinutes": 120,
    "oldFailuresToday": 57
  }
}

정확한 계산이 어렵다면 best-effort로 구현한다.

---

### 3.4 nextAction 개선

예시:

현재 정상:

- “Mongi is running normally.”

현재 정상 + 과거 실패 있음:

- “Mongi is currently healthy. Earlier monitor failures were detected today.”

CDP unreachable:

- “Open Mongi Start.app or click Start Mongi because CDP Chrome is unreachable.”

launchd not loaded:

- “Run npm run launchd:install because launchd is not loaded.”

usage page missing:

- “Confirm Codex/Claude usage pages are open in the CDP Chrome profile.”

policy warning:

- “Review config/policy.json because invalid values were found.”

---

## 4. Safe verification / dry-run notification mode 요구사항

현재 문제:

- `verify:local` 또는 일부 테스트가 실제 Discord 메시지를 보낼 수 있음
- 검증 중 weekly_idle 같은 실제 알림이 발송된 적 있음
- V1 마감 전 반복 검증이 불편함

### 4.1 dry-run 설정

다음 중 하나 이상을 지원한다.

환경변수:

- `DRY_RUN_NOTIFICATIONS=true`

CLI option:

- `--dry-run-notifications`

또는 둘 다.

dry-run mode에서는:

- Discord webhook 호출을 하지 않는다.
- 대신 “would send notification” 정보를 출력한다.
- state 변경은 가능하면 실제 mode와 동일하게 하되, 알림 발송 여부는 구분한다.

권장 출력:

{
  "notificationsSent": 0,
  "notificationsWouldSend": 1,
  "dryRunNotifications": true
}

---

### 4.2 notificationDispatcher 수정

`src/notifications/notificationDispatcher.js` 또는 관련 파일에 dry-run mode를 추가한다.

요구사항:

- dry-run true면 Discord API 호출 금지
- 어떤 이벤트가 발송 대상이었는지 기록
- quiet hours suppress와 dry-run suppress를 구분
- test/scenario가 깨지지 않도록 기존 behavior 유지

---

### 4.3 verify:local:safe 추가

package script 추가:

- `verify:local:safe`

목표:

- 기존 `verify:local`과 비슷하게 주요 검증을 수행
- Discord 실발송 없음
- `test:discord`는 실행하지 않음
- monitor를 실행하더라도 dry-run notification mode 사용

예시 내부 구성:

- health
- logs:summary
- policy:check
- status:json
- daily:summary -- --json
- value:review -- --json
- test:state
- test:scenarios
- monitor with dry-run notifications, if safe

실제 구성은 기존 scripts에 맞춰 Agent가 판단한다.

---

### 4.4 test:discord 정책

`test:discord`는 유지한다.

하지만 README에 명확히 적는다.

- `npm run test:discord`는 실제 Discord 메시지를 보낸다.
- 일반 검증은 `npm run verify:local:safe`를 사용한다.
- Discord webhook 자체를 확인하고 싶을 때만 `test:discord`를 실행한다.

---

## 5. Local `.app` build/install workflow 요구사항

현재 상태:

- SwiftUI app은 Swift Package로 존재
- `swift build --package-path macos/Mongi`는 통과
- Xcode에서 `macos/Mongi/Package.swift`를 열어 실행 가능
- 아직 packaged `.app` workflow가 명확하지 않음

목표:

- 사용자가 Xcode를 매번 열지 않고 Mongi를 실행할 수 있는 루틴을 만든다.
- 최소한 문서화한다.
- 가능하면 build/install script를 제공한다.

---

### 5.1 가능한 구현 방식

Swift Package app의 특성상 `.app` bundling이 환경마다 다를 수 있다.

Agent는 현실적인 방식을 선택한다.

Option A — Documented Xcode local app workflow

- Xcode에서 Package.swift 열기
- Product → Build
- Product → Show Build Folder in Finder
- app을 Dock에 추가하는 방법 문서화

Option B — `scripts/build-mongi-app.sh`

가능하면 script 생성.

역할:

- `swift build --package-path macos/Mongi`
- 산출물 위치 확인
- `.app` bundle이 있으면 경로 출력
- 없으면 Xcode build 안내

Option C — `scripts/open-mongi-app.sh`

- Xcode 없이 가능한 경우 built app 실행
- 불가능하면 Xcode manual steps 안내

필수는 Option A 문서화다.  
Option B/C는 가능하면 구현한다.

---

### 5.2 README 업데이트

README에 다음 추가:

### Install Mongi macOS app locally

포함:

- Swift Package prototype이라는 점
- Xcode로 여는 법
- build/run 방법
- Dock에 올리는 법
- project root 설정
- menu bar mode 사용
- Start Mongi 버튼
- Refresh
- safe verification

### Daily V1 app workflow

예시:

1. Open Mongi app
2. Check menu bar status
3. If CDP unreachable, click Start Mongi
4. Let launchd monitor run
5. Use Daily Summary / Value Review when needed
6. Use `npm run verify:local:safe` for debugging

---

## 6. 파일 변경 후보

생성/수정 예상 파일:

- `scripts/status-json.js`
- `src/notifications/notificationDispatcher.js`
- `src/notifications/discord.js`
- `src/config.js`
- `src/monitor.js`
- `scripts/verify-local-automation.sh`
- `scripts/build-mongi-app.sh`
- `scripts/open-mongi-app.sh`
- `package.json`
- `README.md`
- SwiftUI files if status JSON model needs new fields:
  - `macos/Mongi/Mongi/Models/MongiStatus.swift`
  - `macos/Mongi/Mongi/Views/StatusOverviewView.swift`
  - `macos/Mongi/Mongi/Views/MenuBarStatusView.swift`
  - `macos/Mongi/Mongi/Views/NextActionView.swift`

Agent should inspect current implementation and make minimal necessary changes.

---

## 7. 검증 명령

Node validation:

- `npm run status:json`
- `npm run policy:check`
- `npm run daily:summary -- --json`
- `npm run value:review -- --json`
- `npm run health`
- `npm run logs:summary`
- `npm run test:state`
- `npm run test:scenarios`
- `npm run verify:local:safe`

Dry-run validation:

- Run monitor or verification with `DRY_RUN_NOTIFICATIONS=true`
- Confirm no Discord webhook call is made
- Confirm would-send count is reported if applicable

Swift validation:

- `swift build --package-path macos/Mongi`

If possible:

- Verify Swift model still parses updated `status:json`

Security validation:

- status JSON does not expose webhook
- dry-run output does not expose webhook
- app output does not expose `.env`
- no full logs/full state dumped

---

## 8. 성공 기준

Phase-d-01d 완료 조건:

1. `status:json` no longer reports warning solely because of stale historical failures when current state is healthy.
2. `status:json` distinguishes current status from history warnings.
3. `nextAction` is clearer and current-state based.
4. SwiftUI/menu bar still builds after status JSON changes.
5. dry-run notification mode exists.
6. `verify:local:safe` exists and does not send Discord messages.
7. `test:discord` remains explicit real-send command.
8. local `.app` build/install workflow is documented.
9. build/open helper scripts exist if practical.
10. existing Node scripts and Swift build still pass.

---

## 9. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-d-01d Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Status severity result
- stale failure handling yes/no
- current vs history distinction yes/no
- nextAction example

6. Safe verification result
- dry-run notifications yes/no
- verify:local:safe yes/no
- Discord real-send avoided yes/no
- notificationsWouldSend example

7. Local app workflow result
- build script yes/no
- open script yes/no
- README install workflow yes/no

8. SwiftUI compatibility
- swift build passed yes/no
- status model updated yes/no
- menu bar still builds yes/no

9. Security checks
- webhook exposed no
- env dump exposed no
- full logs exposed no
- full state exposed no

10. Remaining risks
- ...

11. Next recommended phase
- Phase-d-03 — Always-on environment review
  or Phase-e-01 — V1 release candidate cleanup

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full logs를 붙이지 말 것.
- full state dump를 붙이지 말 것.

---

## 10. 핵심 판단

Phase-d-01d는 V1 앱 안정화 작업이다.

새 기능을 많이 만드는 단계가 아니다.

이 Phase의 목표는 세 가지다.

1. 앱 상태가 정확해야 한다.
2. 검증이 안전해야 한다.
3. 앱 실행 루틴이 명확해야 한다.

이 작업이 끝나면 Mongi는 “개발 중인 로컬 스크립트”가 아니라 “매일 사용할 수 있는 로컬 macOS 도구”에 가까워진다.