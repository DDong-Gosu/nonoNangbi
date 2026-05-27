# phase-d-01_SPEC.md

## Phase-d-01 — SwiftUI macOS app prototype

## 0. 목적

Phase-d-01의 목적은 Mongi Usage Coach를 터미널 중심 로컬 도구에서 macOS 앱 형태로 감싸는 첫 prototype을 만드는 것이다.

지금까지 Mongi는 다음 기능을 갖췄다.

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
- Automator launcher guide

하지만 사용자는 여전히 많은 확인 작업을 터미널로 해야 한다.

Phase-d-01에서는 SwiftUI 기반 macOS 앱 prototype을 만들어 다음을 가능하게 한다.

- Mongi Start 버튼
- 현재 상태 표시
- CDP Chrome 상태 표시
- launchd 상태 표시
- Codex/Claude remaining 표시
- 오늘 monitor run summary 표시
- policy 요약 표시
- next action 표시
- refresh 버튼
- value review 진입점 제공

이 Phase의 목표는 완성형 앱이 아니라 “쓸 수 있는 앱 껍데기”다.

---

## 1. 핵심 방향

SwiftUI 앱은 처음부터 모든 기능을 직접 구현하지 않는다.

권장 구조:

SwiftUI App
→ Node script 실행
→ JSON output 읽기
→ UI에 표시

즉 SwiftUI 앱은 기존 Mongi core를 재작성하지 않는다.

앱이 호출할 기존 command:

- `npm run status:json`
- `npm run start:chrome`
- `npm run health`
- `npm run daily:summary`
- `npm run value:review`
- `npm run policy:check`

가장 중요한 command:

- `npm run status:json`

SwiftUI 앱은 이 JSON을 읽어 UI를 표시한다.

---

## 2. 포함 범위

Phase-d-01에 포함되는 작업:

1. SwiftUI macOS app project 생성
2. 앱 이름: `Mongi`
3. project 내부에서 shell command 실행 helper 작성
4. `npm run status:json` 호출
5. JSON parsing model 작성
6. Status overview UI 작성
7. Usage cards UI 작성
8. Today summary UI 작성
9. Policy summary UI 작성
10. Actions section 작성
11. Start Mongi 버튼 구현
12. Refresh 버튼 구현
13. README에 SwiftUI prototype 사용법 추가

---

## 3. 제외 범위

Phase-d-01에서 하지 않을 것:

- App Store 배포
- notarization
- code signing 고도화
- menu bar app
- background daemon
- Chrome Extension
- HTML dashboard
- login system
- database
- settings edit UI
- policy editing UI
- charts
- push notification
- Discord webhook editing
- full log viewer
- AI-generated reports

Phase-d-01은 prototype이다.

---

## 4. 앱 위치 / 파일 구조

권장 위치:

- `macos/Mongi/`

예상 구조:

- `macos/Mongi/Mongi.xcodeproj`
- `macos/Mongi/Mongi/MongiApp.swift`
- `macos/Mongi/Mongi/ContentView.swift`
- `macos/Mongi/Mongi/Models/MongiStatus.swift`
- `macos/Mongi/Mongi/Services/ShellRunner.swift`
- `macos/Mongi/Mongi/Services/MongiStatusService.swift`
- `macos/Mongi/Mongi/Views/StatusOverviewView.swift`
- `macos/Mongi/Mongi/Views/UsageCardView.swift`
- `macos/Mongi/Mongi/Views/TodaySummaryView.swift`
- `macos/Mongi/Mongi/Views/PolicySummaryView.swift`
- `macos/Mongi/Mongi/Views/ActionsView.swift`

주의:

Xcode project 생성은 CLI에서 가능한 방식이면 좋다.  
만약 xcodeproj 자동 생성이 어렵다면 Swift Package 또는 최소 Xcode project 생성 절차를 문서화한다.

하지만 가능하면 Agent가 실제로 열 수 있는 macOS app project를 생성한다.

---

## 5. project root 설정

SwiftUI 앱은 Mongi Node project root를 알아야 한다.

MVP 방식:

- 앱 내부에 기본 project root path를 저장
- 또는 user defaults에 project root 저장
- 또는 현재 repo 기준 상대 경로 사용

권장 prototype 방식:

- `MongiProjectConfig.swift`에 project root 상수 생성
- 기본값은 현재 repo absolute path
- README에 사용자별 수정 방법 문서화

예시:

let mongiProjectRoot = "/Users/shadowmoon/nonoNangbi/nonoNangbi"

주의:

이 값은 개인 local path다.  
오픈소스 배포용 일반화는 Phase-d-01 범위가 아니다.

---

## 6. ShellRunner 요구사항

`ShellRunner`는 macOS 앱에서 shell command를 실행한다.

필수 기능:

- command 실행
- working directory 지정
- stdout capture
- stderr capture
- exit code capture
- timeout 지원 optional
- 에러 메시지 UI로 전달

실행 방식 예시:

- `/bin/zsh -lc "npm run status:json"`

주의:

macOS 앱 환경에서는 PATH가 터미널과 다를 수 있다.  
따라서 npm path 문제를 고려해야 한다.

권장:

1. `/usr/local/bin/npm`
2. `/opt/homebrew/bin/npm`
3. fallback `npm`

또는:

- `/bin/zsh -lc 'source ~/.zprofile; npm run status:json'`

단, 너무 복잡하게 만들지 않는다.

---

## 7. Status JSON parsing

앱은 `npm run status:json` 결과를 parsing한다.

필수 model:

- generatedAt
- overallStatus
- nextAction
- health
- usage.codex
- usage.claude
- today
- policy
- warnings

Swift Codable 구조체를 만든다.

JSON parsing 실패 시:

- raw output 일부 표시
- “Run npm run status:json in terminal to debug” 안내
- 앱 crash 금지

---

## 8. UI 요구사항

UI는 단순하고 실용적으로 만든다.

### 8.1 Header

표시:

- Mongi
- overall status badge
- generatedAt
- Refresh button

### 8.2 Status Overview

표시:

- CDP reachable
- launchd loaded
- quiet hours active
- browser mode
- next action

### 8.3 Usage Cards

Codex:

- short remaining
- weekly remaining
- failures
- last checked

Claude:

- short remaining
- weekly remaining
- failures
- last checked

주의:

Claude raw used / remaining 의미가 혼동되지 않도록 “remaining”이라고 명확히 표시한다.

### 8.4 Today Summary

표시:

- runs
- successful
- failed
- notifications sent
- events list
- quiet hours suppression hint

### 8.5 Policy Summary

표시:

- session stopped enabled
- weekly idle enabled
- diagnostics enabled
- session stopped minutes
- weekly idle reminder hours
- diagnostic reminder hours
- quiet hours window
- message intensity

### 8.6 Actions

버튼:

- Start Mongi
  - `npm run start:chrome`
- Refresh Status
  - `npm run status:json`
- Run Health Check
  - `npm run health`
- Run Daily Summary
  - `npm run daily:summary`
- Run Value Review
  - `npm run value:review`

Phase-d-01에서는 command output을 간단한 text area 또는 sheet에 보여준다.

---

## 9. UX 원칙

앱은 조용하고 실용적이어야 한다.

원칙:

- 사용자를 방해하지 않는다.
- 자동으로 Chrome을 켜지 않는다.
- 앱 실행만으로 shell command를 무분별하게 실행하지 않는다.
- Refresh는 명시적으로 실행한다.
- Start Mongi 버튼은 사용자가 누를 때만 실행한다.
- 실패 시 다음 행동을 보여준다.

앱이 launchd를 직접 조작하지 않아도 된다.  
launchd install/uninstall은 아직 터미널/README로 유지한다.

---

## 10. 디자인 방향

Mongi는 “귀여운 장난감 앱”이 아니라 “조용한 실행 코치”다.

기본 디자인:

- macOS native SwiftUI
- 카드 기반 layout
- 과한 애니메이션 없음
- status color는 최소한만 사용
- 텍스트는 짧고 직접적
- next action이 눈에 잘 보여야 함

상태 색상:

- ok: green
- warning: yellow/orange
- error: red/critical

색상은 system color 사용 권장.

---

## 11. 보안 요구사항

앱은 secrets를 표시하면 안 된다.

금지:

- Discord Webhook URL 표시
- `.env` 내용 표시
- cookies/session data 표시
- full logs 표시
- full state dump 표시

앱은 `status:json`을 읽는 것이 기본이다.  
`status:json`이 secrets를 노출하지 않는다는 전제에 의존한다.

---

## 12. README 업데이트

README에 추가:

### SwiftUI macOS prototype

포함:

- 위치: `macos/Mongi`
- Xcode에서 여는 법
- project root path 설정 방법
- 앱에서 가능한 작업
- 앱에서 불가능한 작업
- `npm run status:json` 기반으로 동작한다는 점
- Start Mongi 버튼 설명
- troubleshooting

Troubleshooting:

- npm path issue
- status JSON parse failed
- CDP unreachable
- project root wrong
- command permission issue

---

## 13. 검증 명령

Agent는 가능한 경우 아래를 실행한다.

Node side:

npm run status:json
npm run policy:check
npm run daily:summary -- --json
npm run value:review -- --json
npm run health
npm run test:state
npm run test:scenarios

Swift side:

가능하면:

xcodebuild -project macos/Mongi/Mongi.xcodeproj -scheme Mongi -configuration Debug build

또는 Swift Package 방식이면:

swift build

불가능하면:

- project 생성 여부 확인
- Swift files syntax 검토
- README에 manual build steps 명확히 작성

---

## 14. 성공 기준

Phase-d-01 완료 조건:

1. SwiftUI macOS app prototype이 repo 안에 존재한다.
2. 앱이 `npm run status:json`을 실행할 수 있다.
3. 앱이 status JSON을 parsing할 수 있다.
4. 앱에서 CDP, launchd, usage, today, policy, nextAction을 볼 수 있다.
5. Start Mongi 버튼이 `npm run start:chrome`을 실행한다.
6. Refresh Status 버튼이 status를 갱신한다.
7. Health/Daily/Value Review command output을 볼 수 있다.
8. 앱이 secrets/full logs/full state를 표시하지 않는다.
9. README에 실행 방법이 문서화되어 있다.
10. 기존 Node scripts가 깨지지 않는다.

---

## 15. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-d-01 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. SwiftUI app result
- project path
- build status
- status parsing yes/no
- Start Mongi button yes/no
- Refresh button yes/no

6. UI sections
- ...

7. Node integration result
- status:json
- start:chrome
- health
- daily summary
- value review

8. Security checks
- webhook exposed no
- env dump exposed no
- full logs exposed no
- full state exposed no

9. Manual steps
- ...

10. Remaining risks
- ...

11. Next recommended phase
- Phase-d-01b — SwiftUI usability polish
  or Phase-d-02 — Chrome Extension feasibility

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full logs를 붙이지 말 것.
- full state dump를 붙이지 말 것.

---

## 16. 핵심 판단

Phase-d-01은 Mongi를 진짜 앱으로 바꾸는 첫 단계다.

하지만 core logic은 Node 쪽에 남긴다.

SwiftUI 앱은 처음에는 wrapper다.

이 접근이 맞는 이유:

- 기존 monitor/event/parser를 재작성하지 않아도 된다.
- SwiftUI 앱을 빠르게 만들 수 있다.
- Node CLI와 앱이 같은 status JSON contract를 공유한다.
- 나중에 menu bar app으로 확장하기 쉽다.

Phase-d-01의 목표는 완벽한 앱이 아니다.

목표는 이거다.

“터미널 없이 Mongi 상태를 보고, Mongi를 시작할 수 있는 macOS 앱 prototype.”