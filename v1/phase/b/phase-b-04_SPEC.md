# phase-b-04_SPEC.md

## Phase-b-04 — Desktop launcher + non-disruptive background monitoring

## 0. 목적

Phase-b-04의 목적은 Mongi Usage Coach를 실제로 매일 사용할 수 있는 macOS 로컬 도구로 다듬는 것이다.

현재 Mongi는 기능적으로 작동한다.

완료된 것:

- Codex/Claude usage extraction
- usage normalization
- event detection
- Discord notification
- CDP Chrome starter
- launchd monitor automation
- health/log/verify tools

하지만 실사용 UX에 중요한 문제가 남아 있다.

현재 문제:

1. 사용자는 터미널 명령이 아니라 바탕화면/독에서 누르는 “스위치”를 원한다.
2. `Mongi Start.command`는 작동하지만 앱처럼 느껴지지 않는다.
3. launchd monitor가 실행될 때 Codex/Claude usage tab/window가 foreground로 튀거나 포커스를 빼앗으면 사용성이 치명적으로 나빠진다.
4. 맥북 sleep 이후 CDP Chrome이 꺼져 있으면 health가 `CDP reachable: no`가 되며, 사용자는 다시 starter를 눌러야 한다.
5. 이 흐름은 명확히 문서화되어야 한다.

Phase-b-04는 다음을 해결한다.

- Automator app 기반 “Mongi Start.app” 생성 가이드
- Shortcuts 대안 가이드
- 기존 `.command` 개선
- monitor가 scheduled run 중 foreground focus를 훔치지 않도록 extractor/monitor 수정
- usage tab/window 중복 생성 방지
- starter와 monitor의 역할 분리 명확화
- health/README 문구 개선

이 Phase가 끝나면 사용자는 다음 루틴을 가질 수 있어야 한다.

Mac 열기
→ Mongi Start.app 또는 Mongi Start.command 실행
→ CDP Chrome 준비
→ launchd가 10분마다 조용히 monitor 실행
→ Discord 알림 수신

---

## 1. 현재 시스템 상태

현재 상태:

- `npm run start:chrome` works
- `Mongi Start.command` exists
- `npm run check:cdp` works
- launchd is installed and loaded
- launchd StartInterval 600초 반복 실행 확인됨
- `npm run health` works
- `npm run logs:summary` works
- `npm run verify:local` works

실제 sleep/wake 후 확인된 상태:

- launchd loaded: yes
- CDP reachable: no
- last exit code: 1
- Next action: run `npm run start:chrome` or double-click `Mongi Start.command`

이것은 정상적인 failure state다.  
다만 사용자 경험상 더 쉽게 복구할 수 있어야 한다.

---

## 2. 포함 범위

Phase-b-04에 포함되는 작업:

1. Automator app 생성 가이드 작성
2. Shortcuts app 생성 가이드 작성
3. `Mongi Start.command` 출력/사용성 개선
4. `npm run launcher:guide` 추가
5. monitor/extractor의 foreground focus stealing 방지
6. scheduled monitor run 중 새 tab/window 생성 최소화
7. 기존 usage tab 재사용 정책 구현 또는 강화
8. CDP Chrome이 열려 있지만 usage tab이 없을 때 처리 정책 정리
9. health check의 next action 문구 개선
10. README daily workflow 업데이트
11. Phase-b 운영 UX 검증

---

## 3. 제외 범위

Phase-b-04에서 하지 않을 것:

- SwiftUI macOS app 개발
- menu bar app 개발
- Chrome Extension 개발
- launchd가 Chrome을 자동 시작하게 만들기
- VPS/미니PC/always-on 운영
- event policy 대규모 변경
- Discord message 대규모 변경
- parser heuristic 대규모 변경
- AI API 기반 message generation
- database/dashboard 추가

SwiftUI 앱은 Phase-d-01의 2차 목표로 둔다.  
Automator app이 1차 목표다.

---

## 4. 핵심 UX 원칙

## 4.1 시작은 사용자가 한다

Mongi는 사용자가 하루 시작 시 명시적으로 켠다.

허용된 시작 방식:

- `Mongi Start.app`
- `Mongi Start.command`
- `npm run start:chrome`

launchd는 Chrome을 자동으로 켜지 않는다.  
launchd는 monitor만 실행한다.

이유:

- 로그인/Turnstile은 사람이 처리해야 할 수 있다.
- Chrome 자동 시작이 불시에 창을 띄우면 UX가 나쁘다.
- 사용자가 작업 시작 루틴으로 Mongi를 켜는 것이 더 안정적이다.

## 4.2 monitor는 조용해야 한다

가장 중요한 불변 규칙:

**Scheduled monitor runs must never steal foreground focus.**

launchd가 10분마다 실행될 때:

- 새 Chrome 창을 foreground로 띄우면 안 된다.
- 새 usage tab을 매번 만들면 안 된다.
- 현재 사용 중인 앱의 키보드 포커스를 빼앗으면 안 된다.
- 사용자가 타이핑 중인 흐름을 끊으면 안 된다.

monitor는 조용히 상태를 읽고 종료해야 한다.

## 4.3 starter와 monitor의 역할을 분리한다

starter:

- CDP Chrome을 시작한다.
- 필요한 usage pages를 연다.
- 사용자가 로그인/Turnstile을 처리할 수 있게 한다.

monitor:

- 이미 열린 CDP Chrome에 붙는다.
- 기존 usage tab을 재사용한다.
- 가능하면 새 tab/window를 만들지 않는다.
- usage state만 읽는다.
- event notification을 보낸다.

---

## 5. Automator app 목표

Phase-b-04의 1차 packaging 목표는 Automator app이다.

목표:

- 사용자가 `Mongi Start.app`을 만들 수 있어야 한다.
- Dock 또는 Desktop에 올릴 수 있어야 한다.
- 앱을 클릭하면 내부적으로 `npm run start:chrome`을 실행한다.

Agent가 직접 Automator GUI를 조작하지는 않는다.  
대신 다음을 제공한다.

1. Automator에 넣을 shell script
2. step-by-step 생성 가이드
3. 앱 이름 추천
4. icon 변경 가이드 optional
5. 실패 시 `.command` fallback 안내

권장 Automator shell script:

cd /Users/shadowmoon/nonoNangbi/nonoNangbi
/opt/homebrew/bin/npm run start:chrome || /usr/local/bin/npm run start:chrome

단, path는 현재 프로젝트에서 자동 출력할 수 있어야 한다.

---

## 6. Shortcuts app 목표

Shortcuts는 대안이다.

Phase-b-04에서 제공할 것:

- Shortcuts에서 “Run Shell Script” action으로 실행할 명령
- shortcut 이름 추천: Mongi Start
- Dock/Menu bar/Spotlight 실행 방법 설명
- Automator와 비교한 추천

권장:

- 1차 추천은 Automator app
- Shortcuts는 사용자가 선호하면 선택

---

## 7. launcher guide 요구사항

새 script 권장:

- `scripts/launcher-guide.js`

npm script:

- `launcher:guide`

동작:

1. 현재 project root 계산
2. 사용자의 npm 경로 감지
3. Automator용 shell script 출력
4. Shortcuts용 shell script 출력
5. `.command` fallback 위치 출력
6. 현재 CDP 상태 출력 optional

출력 예시:

Mongi Launcher Guide

Automator app script:

cd "/Users/shadowmoon/nonoNangbi/nonoNangbi"
/usr/local/bin/npm run start:chrome

Steps:
1. Open Automator
2. New Document → Application
3. Add Run Shell Script
4. Paste the script above
5. Save as Mongi Start.app
6. Move it to Desktop or Dock

주의:

- `.env` 내용 출력 금지
- Discord Webhook URL 출력 금지

---

## 8. Mongi Start.command 개선

`Mongi Start.command`는 계속 유지한다.

개선 목표:

- 출력 메시지를 짧고 명확하게
- CDP already running이면 성공처럼 안내
- next action에 `npm run health` 포함
- launchd가 monitor를 자동 실행 중이라는 점 설명
- 터미널 창이 바로 닫히지 않도록 필요 시 안내

예상 출력:

Mongi Start

1. CDP Chrome 준비 중...
2. Codex/Claude usage page를 확인하세요.
3. launchd monitor는 10분마다 자동 실행됩니다.
4. 상태 확인: npm run health

너무 길면 안 된다.

---

## 9. Non-disruptive monitor 요구사항

현재 가장 중요한 기술 작업이다.

monitor/extractor는 scheduled launchd run 중 포커스를 훔치지 않아야 한다.

구현 원칙:

1. CDP browser context에 연결한다.
2. 기존 열린 pages 중 service usage URL과 매칭되는 tab을 먼저 찾는다.
3. 찾으면 그 page를 재사용한다.
4. `page.bringToFront()`를 호출하지 않는다.
5. 매 monitor run마다 `context.newPage()`로 새 탭을 만들지 않는다.
6. 사용자가 starter를 실행할 때만 usage pages를 여는 것을 기본 정책으로 한다.
7. monitor에서 usage page가 없으면:
   - 옵션 A: 새 탭을 열지 않고 service parse failure로 처리
   - 옵션 B: 새 탭을 background로 열 수 있으면 열기
   - 기본 추천: scheduled monitor에서는 새 탭을 열지 않는다.

권장 정책:

- monitor mode에서는 `openMissingPages=false`
- debug mode 또는 starter에서는 `openMissingPages=true`

---

## 10. extractor API 개선

기존 `usageExtractor` 또는 유사 모듈에 option을 추가한다.

예시 옵션:

- `openMissingPages`
- `reuseExistingPages`
- `allowFocusSteal`

기본값:

For monitor:

- openMissingPages: false
- reuseExistingPages: true
- allowFocusSteal: false

For debug-page-text:

- openMissingPages: true
- reuseExistingPages: true
- allowFocusSteal: false

For starter:

- page opening handled by shell script, not extractor

주의:

- `allowFocusSteal`이 false면 `bringToFront` 금지
- code search로 `bringToFront` 사용 여부를 확인한다
- Playwright `newPage`가 어쩔 수 없이 foreground를 만들 수 있다면 scheduled monitor에서는 사용하지 않는다

---

## 11. usage tab matching

서비스별 page matching rule을 구현 또는 강화한다.

Codex:

- URL includes `chatgpt.com`
- URL includes `codex`
- URL includes `analytics` or `usage`

Claude:

- URL includes `claude.ai`
- URL includes `settings`
- URL includes `usage`

주의:

- URL hash나 path가 조금 달라질 수 있으므로 너무 좁게 잡지 않는다.
- fallback으로 service hostname 기반 matching 가능
- 잘못된 페이지를 읽어 high confidence로 판단하면 안 된다.

---

## 12. missing usage tab policy

scheduled monitor에서 usage tab이 없을 때:

- 해당 service result는 failure로 반환
- errorReason: `usage_page_not_open`
- diagnostic message는 rate-limited
- health check next action: “Run Mongi Start.app or npm run start:chrome and confirm usage pages are open.”

debug-page-text에서는:

- missing usage tab이면 새 page를 열 수 있다
- diagnostic files를 생성한다

이 정책은 README에 명시한다.

---

## 13. health check 개선

`npm run health`에서 CDP unreachable 또는 usage page missing에 대해 더 친절하게 안내한다.

추가 next actions:

CDP unreachable:

- Open Mongi Start.app
- or double-click Mongi Start.command
- or run npm run start:chrome

Usage page missing:

- Run npm run start:chrome
- Confirm Codex/Claude usage pages are open
- Then run npm run monitor

Quiet hours:

- No Discord notification may be sent during quiet hours
- This is not necessarily failure

---

## 14. README 업데이트

README에 다음 섹션을 추가/수정한다.

### Daily startup

1. Open MacBook
2. Click `Mongi Start.app` or `Mongi Start.command`
3. Confirm Codex/Claude usage pages are visible
4. Run `npm run health` if unsure
5. Let launchd monitor run every 10 minutes

### Create Automator app

Step-by-step:

1. Open Automator
2. New Document
3. Choose Application
4. Add “Run Shell Script”
5. Paste script from `npm run launcher:guide`
6. Save as `Mongi Start.app`
7. Move to Desktop or Dock

### Create Shortcut app

Alternative guide.

### Non-disruptive monitoring

Explain:

- Monitor should not open new tabs every 10 minutes.
- Monitor reuses existing usage pages.
- If pages are missing, monitor reports failure instead of stealing focus.
- Run starter manually to restore pages.

### Sleep/wake behavior

Explain:

- Mac sleep pauses launchd runs.
- On wake, launchd resumes.
- CDP Chrome may not survive sleep.
- If `CDP reachable: no`, run starter again.

---

## 15. 검증 요구사항

Agent는 작업 후 다음을 실행한다.

Syntax:

node -c scripts/launcher-guide.js
node -c scripts/health-check.js
node -c scripts/summarize-launchd-logs.js
node -c src/extractors/usageExtractor.js
node -c src/monitor.js

Search checks:

- Search for `bringToFront`
- Search for unconditional `newPage` in monitor/extractor path
- Confirm scheduled monitor does not always open new pages

Command validation:

npm run launcher:guide
npm run health
npm run logs:summary
npm run test:state
npm run test:scenarios
npm run check:cdp
npm run monitor

If CDP Chrome and usage pages are open:

- `npm run monitor` should parse successfully without opening duplicate tabs.
- Verify tab count does not increase unnecessarily if practical.

If usage pages are missing:

- monitor should not steal focus.
- monitor should fail gracefully with `usage_page_not_open`.

---

## 16. 성공 기준

Phase-b-04 완료 조건:

1. Automator app 생성 가이드가 README에 있다.
2. `npm run launcher:guide`가 Automator/Shortcuts용 shell script를 출력한다.
3. `Mongi Start.command` UX가 개선되어 있다.
4. scheduled monitor는 foreground focus를 훔치지 않는다.
5. scheduled monitor는 매번 새 usage tab/window를 만들지 않는다.
6. monitor는 기존 usage tab을 재사용한다.
7. usage tab이 없으면 monitor가 조용히 실패하고 next action을 안내한다.
8. `npm run health`가 CDP unreachable/missing pages 상황을 명확히 안내한다.
9. 기존 scenario/test/monitor 명령이 깨지지 않는다.
10. README에 daily startup, Automator app, sleep/wake, non-disruptive monitoring이 문서화되어 있다.

---

## 17. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-b-04 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Launcher guide result
- ...

6. Non-disruptive monitor result
- focus stealing prevented yes/no
- duplicate tab prevention yes/no
- missing usage tab behavior

7. Health check updates
- ...

8. Manual Automator steps
- ...

9. Remaining operational risks
- ...

10. Next recommended phase
- Phase-c-01 — Real-world usage validation + daily summary

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full page text를 보고하지 말 것.
- full logs를 붙이지 말 것.

---

## 18. 핵심 판단

Phase-b-04는 Mongi를 “작동하는 스크립트”에서 “매일 쓸 수 있는 로컬 도구”로 바꾸는 단계다.

이 Phase에서 가장 중요한 것은 예쁜 앱이 아니다.

가장 중요한 것은:

- 한 번 눌러 켤 수 있음
- 10분마다 돌아도 방해하지 않음
- 문제가 생기면 바로 복구 행동을 알 수 있음

Automator app은 1차 목표다.  
SwiftUI app은 2차 목표이며, 실제 사용 후 상태 UI가 필요하다고 판단될 때 진행한다.