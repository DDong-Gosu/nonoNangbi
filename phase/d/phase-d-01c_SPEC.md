# phase-d-01c_SPEC.md

## Phase-d-01c — Menu bar app exploration + lightweight status access

## 0. 목적

Phase-d-01c의 목적은 Mongi SwiftUI 앱을 독립 창 앱에서 한 단계 더 나아가, macOS menu bar 중심의 가벼운 실행 도구로 확장할 수 있는지 검토하고 prototype을 만든다.

Mongi는 매일 계속 열어두고 확인하는 도구에 가깝다.

사용자는 다음을 원한다.

- 터미널을 열지 않고 상태 확인
- Mongi Start를 빠르게 실행
- CDP/launchd 상태 빠르게 확인
- Codex/Claude remaining 빠르게 확인
- weekly_idle / daily summary / nextAction 빠르게 확인
- 큰 앱 창을 매번 띄우지 않아도 됨

이 성격상 메뉴바 앱이 잘 맞는다.

Phase-d-01c는 완성형 메뉴바 앱이 아니라, SwiftUI prototype에 menu bar access를 추가하는 단계다.

---

## 1. 현재 상태

전제:

Phase-d-01과 Phase-d-01b가 완료되어 있다.

현재 SwiftUI 앱은 다음을 할 수 있다.

- `npm run status:json` 실행
- status JSON parsing
- CDP/launchd/usage/today/policy 표시
- Start Mongi
- Refresh Status
- Health/Daily/Value Review command 실행
- project root / npm path error handling
- command output 표시

Phase-d-01c는 이 기능을 menu bar에서 더 빠르게 접근할 수 있게 한다.

---

## 2. 포함 범위

Phase-d-01c에 포함되는 작업:

1. SwiftUI menu bar entry 추가
2. menu bar status icon 또는 text 표시
3. menu bar popover 구현
4. compact status view 구현
5. quick actions 구현
6. main window 열기 action 구현
7. refresh action 구현
8. Start Mongi quick action 구현
9. menu bar status refresh strategy 정의
10. README menu bar 사용법 추가

---

## 3. 제외 범위

Phase-d-01c에서 하지 않을 것:

- App Store 배포
- notarization
- advanced code signing
- launchd install/uninstall UI
- background daemon 대체
- Chrome Extension
- policy editing UI
- full settings app
- charts
- AI report generation
- external server
- database
- Node core rewrite

이 Phase는 menu bar 접근성 prototype이다.

---

## 4. Menu bar 방향

권장 구조:

- 기존 SwiftUI app 유지
- menu bar extra 추가
- menu bar popover에서 compact status 표시
- “Open Full App”으로 기존 main window 열기
- “Start Mongi”로 `npm run start:chrome`
- “Refresh”로 `npm run status:json`
- “Quit Mongi” 제공

macOS SwiftUI에서는 가능하면 `MenuBarExtra`를 사용한다.

기본 구조 예시:

- `MongiApp.swift`
  - `WindowGroup`
  - `MenuBarExtra`

단, macOS target version에 따라 `MenuBarExtra` 사용 가능 여부를 확인한다.  
사용 불가능하면 `NSStatusItem` bridge를 검토한다.

---

## 5. Menu bar 표시 요구사항

메뉴바에는 최소한 다음 중 하나를 표시한다.

Option A:

- text: `Mongi`

Option B:

- status symbol:
  - OK: filled circle
  - Warning: exclamation
  - Error: xmark

Option C:

- remaining summary:
  - `Mongi 83/100`
  - 너무 길면 비추천

권장:

- Phase-d-01c에서는 `Mongi` + status color/symbol 정도만 사용
- 자세한 내용은 popover에서 표시

---

## 6. Compact popover UI 요구사항

Popover에는 다음을 표시한다.

### 6.1 Status summary

- Overall status
- CDP reachable
- launchd loaded
- nextAction

### 6.2 Usage mini cards

- Codex short/weekly remaining
- Claude short/weekly remaining

### 6.3 Today mini summary

- runs
- failed
- notifications sent
- top events 2~3개

### 6.4 Quick actions

버튼:

- Start Mongi
- Refresh
- Open Full App
- Health Check
- Daily Summary
- Value Review
- Quit

Phase-d-01c에서는 output을 popover 안에 길게 보여주지 않아도 된다.  
Health/Daily/Value Review는 main window의 output panel로 보내거나 sheet로 표시해도 된다.

---

## 7. Refresh strategy

Menu bar app은 너무 자주 command를 실행하면 안 된다.

기본 원칙:

- 앱 실행 시 1회 status load
- 사용자가 popover를 열었을 때 refresh optional
- Refresh 버튼은 명시적 실행
- 자동 refresh는 선택사항

권장:

- Phase-d-01c에서는 자동 refresh를 구현하지 않거나, 매우 보수적으로 구현
- 예: 5분마다 1회 이하
- 자동 refresh 중 Start Mongi는 절대 실행하지 않음

주의:

- `status:json`은 비교적 가볍지만, 그래도 무분별하게 실행하지 않는다.
- Chrome을 자동으로 시작하지 않는다.

---

## 8. App lifecycle 요구사항

메뉴바 앱 특성상 다음 동작을 고려한다.

필수:

- app window를 닫아도 menu bar item은 남아 있을 수 있음
- Quit action 제공
- Open Full App action 제공

선택:

- Dock icon 숨김 여부 검토
- 처음에는 Dock icon 유지 권장
- menu bar only mode는 나중에 검토

권장:

Phase-d-01c에서는 Dock icon을 숨기지 않는다.  
먼저 menu bar access만 추가한다.

---

## 9. Command integration

기존 Phase-d-01b의 `MongiStatusService`와 `ShellRunner`를 재사용한다.

Quick action behavior:

### Start Mongi

1. `npm run start:chrome`
2. 성공 시 `status:json` refresh
3. 실패 시 error 표시

### Refresh

1. `npm run status:json`
2. UI 갱신

### Health/Daily/Value

1. 기존 command 실행
2. output을 main window output panel 또는 popover sheet에 표시
3. 실패해도 crash 금지

---

## 10. Error handling

다음 상황을 menu bar popover에서도 명확히 처리한다.

- project root missing
- npm missing
- status JSON invalid
- CDP unreachable
- launchd not loaded
- command failure

Popover에 긴 에러를 다 표시하지 말고, compact message와 next action을 보여준다.

예시:

- “CDP unreachable”
- “Click Start Mongi”
- “Project root missing”
- “Open Full App to fix”

---

## 11. 보안 요구사항

Menu bar UI에서도 secrets를 표시하지 않는다.

금지:

- Discord Webhook URL
- `.env` contents
- cookies
- browser session data
- full logs
- full state dump

command output이 표시될 경우 Phase-d-01b의 masking logic을 재사용한다.

---

## 12. README 업데이트

README SwiftUI section에 다음 추가:

### Menu bar mode

포함:

- menu bar item 위치
- popover에서 볼 수 있는 정보
- Start Mongi / Refresh / Open Full App 설명
- Quit 설명
- 자동 refresh 정책
- Dock icon은 아직 유지된다는 점
- menu bar only mode는 future work

Troubleshooting:

- menu bar item not visible
- popover status stale
- Start Mongi fails from menu bar
- project root wrong
- npm path issue

---

## 13. 검증 명령

Node validation:

- `npm run status:json`
- `npm run policy:check`
- `npm run daily:summary -- --json`
- `npm run value:review -- --json`
- `npm run health`
- `npm run test:state`
- `npm run test:scenarios`

Swift validation:

가능하면:

- `xcodebuild -project macos/Mongi/Mongi.xcodeproj -scheme Mongi -configuration Debug build`

Manual verification:

- 앱 실행
- menu bar item 표시 확인
- popover 열림 확인
- compact status 표시 확인
- Refresh 클릭
- Start Mongi 클릭
- Open Full App 클릭
- Quit 클릭
- window close 후 menu bar behavior 확인

---

## 14. 성공 기준

Phase-d-01c 완료 조건:

1. SwiftUI 앱에 menu bar item이 생긴다.
2. menu bar popover에서 compact status를 볼 수 있다.
3. CDP/launchd/nextAction이 popover에 표시된다.
4. Codex/Claude remaining이 popover에 표시된다.
5. Start Mongi quick action이 동작한다.
6. Refresh quick action이 동작한다.
7. Open Full App action이 동작한다.
8. Quit action이 동작한다.
9. app이 secrets/full logs/full state를 표시하지 않는다.
10. README에 menu bar 사용법이 추가된다.
11. 기존 Node scripts가 깨지지 않는다.

---

## 15. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-d-01c Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Menu bar result
- menu bar item yes/no
- popover yes/no
- compact status yes/no
- quick actions yes/no

6. SwiftUI integration result
- status service reused yes/no
- Start Mongi action yes/no
- Refresh action yes/no
- Open Full App yes/no

7. Manual verification
- ...

8. Security checks
- webhook exposed no
- env dump exposed no
- full logs exposed no
- full state exposed no

9. Remaining risks
- ...

10. Next recommended phase
- Phase-d-02 — Chrome Extension feasibility

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full logs를 붙이지 말 것.
- full state dump를 붙이지 말 것.

---

## 16. 핵심 판단

Phase-d-01c는 Mongi를 더 macOS다운 도구로 만드는 단계다.

Mongi는 하루 종일 큰 창을 띄워두는 앱이라기보다, 메뉴바에서 상태를 빠르게 보고 필요할 때 누르는 도구에 가깝다.

이 Phase의 목표는 menu bar 완성형 앱이 아니다.

목표는 다음이다.

“메뉴바에서 Mongi 상태를 보고, 바로 Start/Refresh할 수 있는가?”