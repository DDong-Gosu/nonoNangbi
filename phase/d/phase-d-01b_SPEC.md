# phase-d-01b_SPEC.md

## Phase-d-01b — SwiftUI usability polish + app workflow hardening

## 0. 목적

Phase-d-01b의 목적은 Phase-d-01에서 만든 SwiftUI macOS prototype을 실제로 매일 사용할 수 있는 수준으로 다듬는 것이다.

Phase-d-01의 목표는 “작동하는 앱 껍데기”였다.

Phase-d-01b의 목표는 “사용자가 터미널을 덜 열고, 앱에서 Mongi를 켜고 상태를 확인할 수 있는 안정적인 daily workflow”를 만드는 것이다.

핵심 질문:

- 앱을 열었을 때 무엇을 해야 하는지 바로 보이는가?
- Start Mongi 버튼이 안정적으로 작동하는가?
- status JSON parsing 실패 시 원인을 이해할 수 있는가?
- npm path/project root 문제가 덜 발생하는가?
- 앱이 매일 쓰기에 불편하지 않은가?
- SwiftUI 앱이 Node core를 깨지 않고 감싸고 있는가?

---

## 1. 현재 상태

전제:

Phase-d-01에서 SwiftUI macOS app prototype이 생성되어 있다.

앱은 대략 다음을 수행한다.

- `npm run status:json` 실행
- status JSON parsing
- CDP/launchd/usage/today/policy 표시
- Start Mongi 버튼
- Refresh 버튼
- Health/Daily/Value Review command output 표시

Phase-d-01b에서는 기능을 새로 크게 늘리기보다 앱 사용성을 안정화한다.

---

## 2. 포함 범위

Phase-d-01b에 포함되는 작업:

1. project root 설정 UX 개선
2. npm path detection 개선
3. command execution error handling 개선
4. app launch 시 status auto-load 안정화
5. Refresh UX 개선
6. Start Mongi 실행 후 status 재조회
7. command output panel 개선
8. nextAction 강조
9. status badge 개선
10. README SwiftUI 사용법 보강
11. troubleshooting 문서화
12. build validation 개선

---

## 3. 제외 범위

Phase-d-01b에서 하지 않을 것:

- menu bar app 전환
- background daemon
- launchd install/uninstall UI
- policy editing UI
- dashboard server
- Chrome Extension
- App Store packaging
- notarization
- complex settings screen
- charts
- push notification
- AI report generation
- Node core rewrite

이 Phase는 prototype polish다.

---

## 4. Project root 설정 개선

현재 prototype이 absolute path를 hardcode하고 있다면, 최소한 다음 중 하나를 구현한다.

우선순위:

1. 앱 내부 config 파일 또는 Swift constant 유지
2. README에 path 수정 위치 명확히 안내
3. 가능하면 UserDefaults에 project root 저장
4. 가능하면 “Choose Project Folder” 버튼 제공

권장 구현:

- `MongiProjectConfig.swift`에 default path
- 앱 첫 화면 또는 Settings section에 현재 project root 표시
- path가 존재하지 않으면 warning 표시
- `status:json` 실행 전 project root 존재 여부 확인

선택 구현:

- `NSOpenPanel`로 project root 선택
- 선택한 path를 UserDefaults에 저장
- 다음 실행부터 저장된 path 사용

성공 기준:

- project root가 잘못되었을 때 앱이 crash하지 않는다.
- 사용자가 README를 보고 수정하거나 앱에서 선택할 수 있다.

---

## 5. npm path detection 개선

macOS 앱은 terminal과 PATH가 다르다.

따라서 다음 npm path 후보를 확인한다.

- `/usr/local/bin/npm`
- `/opt/homebrew/bin/npm`
- `/usr/bin/npm`
- fallback: `npm`

가능하면 shell에서 다음 방식 사용:

`/bin/zsh -lc 'cd "PROJECT_ROOT" && npm run status:json'`

또는 npm binary path를 직접 사용한다.

ShellRunner는 다음 정보를 error output에 포함한다.

- attempted command
- working directory
- exit code
- stderr summary
- npm path candidates tried

주의:

secrets는 출력하지 않는다.

---

## 6. Command execution UX

모든 command 버튼은 다음 상태를 가져야 한다.

- idle
- running
- success
- failed

필수 버튼:

- Start Mongi
- Refresh Status
- Run Health Check
- Run Daily Summary
- Run Value Review

개선 사항:

- 버튼 실행 중 disabled 처리
- 실행 성공/실패 badge 표시
- 최근 실행 시간 표시
- command output panel에 결과 표시
- output이 길면 scroll 가능하게 표시

Start Mongi 동작:

1. `npm run start:chrome` 실행
2. 성공하면 `npm run status:json` 재실행
3. status UI 갱신
4. 실패하면 stderr summary 표시

Refresh Status 동작:

1. `npm run status:json` 실행
2. parsing 성공 시 UI 갱신
3. parsing 실패 시 raw output 일부 표시

---

## 7. Error handling 요구사항

앱은 다음 상황에서 crash하면 안 된다.

- project root missing
- npm missing
- status:json command fails
- status JSON invalid
- CDP unreachable
- launchd not loaded
- state missing
- daily summary command fails
- value review command fails

각 경우 UI에 다음을 표시한다.

- 무엇이 실패했는지
- 다음 행동
- 관련 terminal command

예시:

CDP unreachable:

- Message: “CDP Chrome is not reachable.”
- Next action: “Click Start Mongi.”
- Command: `npm run start:chrome`

Project root missing:

- Message: “Mongi project folder not found.”
- Next action: “Set the correct project root path.”
- Command: 없음

Invalid JSON:

- Message: “status:json did not return valid JSON.”
- Next action: “Run npm run status:json in terminal to debug.”
- Show: first 1000 characters of output

---

## 8. UI polish 요구사항

UI는 여전히 단순해야 한다.

개선할 것:

### Header

- App title: Mongi
- status badge: OK / Warning / Error
- last refreshed time
- Refresh button

### Next Action Card

가장 잘 보이게 표시한다.

- `nextAction` text
- status severity
- recommended command optional

### Status Cards

- CDP reachable
- launchd loaded
- quiet hours active
- browser mode

### Usage Cards

- Codex remaining
- Claude remaining
- last checked
- failures

### Today Summary

- runs
- successful
- failed
- notifications
- top events

### Output Panel

- selected command output
- copy button optional
- clear button optional

---

## 9. 보안 요구사항

앱은 secrets를 표시하면 안 된다.

금지:

- Discord Webhook URL
- `.env` contents
- cookies
- browser session data
- full logs
- full state dump

command output 중 secrets가 포함될 가능성이 있으면 masking을 적용한다.

필수 masking 후보:

- `https://discord.com/api/webhooks/`
- `DISCORD_WEBHOOK_URL=`
- token-like long strings if obvious

---

## 10. README 업데이트

README SwiftUI section에 다음 추가:

- 앱 열기
- Xcode build
- project root 설정
- npm path 문제 해결
- Start Mongi 버튼 설명
- Refresh Status 설명
- command output 보는 법
- 자주 발생하는 문제

Troubleshooting:

1. Project root wrong
2. npm not found
3. status JSON parse failed
4. CDP unreachable
5. launchd loaded no
6. app build fails
7. Start button works but status still warning

---

## 11. 검증 명령

Node side:

- `npm run status:json`
- `npm run policy:check`
- `npm run daily:summary -- --json`
- `npm run value:review -- --json`
- `npm run health`
- `npm run test:state`
- `npm run test:scenarios`

Swift side:

가능하면:

- `xcodebuild -project macos/Mongi/Mongi.xcodeproj -scheme Mongi -configuration Debug build`

또는 Swift Package라면:

- `swift build`

Manual verification:

- 앱 실행
- Refresh Status 클릭
- Start Mongi 클릭
- Health 클릭
- Daily Summary 클릭
- Value Review 클릭
- project root wrong 상황에서 crash 없는지 확인
- npm path 문제 시 error 표시 확인

---

## 12. 성공 기준

Phase-d-01b 완료 조건:

1. SwiftUI app이 daily workflow에 사용할 수 있을 정도로 안정화된다.
2. project root missing 상황을 처리한다.
3. npm path 문제를 더 잘 처리한다.
4. command 실행 중/성공/실패 상태가 UI에 표시된다.
5. Start Mongi 후 status refresh가 된다.
6. status JSON parsing 실패 시 crash하지 않는다.
7. nextAction이 UI에서 명확하게 보인다.
8. command output panel이 있다.
9. README troubleshooting이 보강된다.
10. 기존 Node scripts가 깨지지 않는다.

---

## 13. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-d-01b Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. SwiftUI usability result
- project root handling
- npm path handling
- command state handling
- status refresh behavior

6. UI polish result
- header
- next action
- status cards
- usage cards
- output panel

7. Error handling result
- project root missing
- npm missing
- invalid status JSON
- command failure

8. Security checks
- webhook exposed no
- env dump exposed no
- full logs exposed no
- full state exposed no

9. Manual verification
- ...

10. Remaining risks
- ...

11. Next recommended phase
- Phase-d-02 — Chrome Extension feasibility
  or Phase-d-01c — menu bar app exploration

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full logs를 붙이지 말 것.
- full state dump를 붙이지 말 것.

---

## 14. 핵심 판단

Phase-d-01b는 기능 욕심을 내는 단계가 아니다.

이 단계의 목적은 앱을 “열 수 있음”에서 “쓸 수 있음”으로 바꾸는 것이다.

특히 중요한 것은:

- Start Mongi
- Refresh Status
- nextAction
- command failure handling
- project root/npm path 안정성

이 네 가지가 잡히면 Mongi는 더 이상 terminal-first 도구가 아니라 app-first local tool이 된다.