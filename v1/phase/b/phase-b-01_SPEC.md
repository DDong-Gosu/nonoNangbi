# phase-b-01_SPEC.md

## Phase-b-01 — One-click CDP Chrome starter

## 0. 목적

Phase-b-01의 목적은 사용자가 긴 Chrome CDP 실행 명령어를 매번 직접 입력하지 않아도 되도록, Mongi Usage Coach 실행 환경을 한 번에 여는 로컬 starter를 만드는 것이다.

현재 수동 실행 명령:

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.mongi-chrome-profile"

Phase-b-01이 끝나면 사용자는 다음 중 하나로 CDP Chrome을 시작할 수 있어야 한다.

- `npm run start:chrome`
- `scripts/start-cdp-chrome.sh`
- `Mongi Start.command` 더블클릭

이 Phase는 launchd 자동 실행을 포함하지 않는다.  
launchd는 Phase-b-02에서 구현한다.

---

## 1. 배경

Phase-a에서 Mongi Usage Coach는 다음을 완료했다.

- Discord Webhook 연결
- Chrome CDP 연결
- Codex/Claude usage page extraction
- usage percent normalization
- event detection
- Mongi random notification
- scenario tests

현재 남은 불편함은 사용자가 매번 터미널에서 CDP Chrome 실행 명령을 직접 입력해야 한다는 점이다.

Phase-b-01은 이 수동 절차를 줄인다.

목표는 완전한 macOS 앱이 아니다.  
목표는 “실제로 매일 쓸 수 있는 시작 버튼”이다.

---

## 2. 포함 범위

Phase-b-01에 포함되는 작업:

1. CDP Chrome 실행 shell script 작성
2. `.command` 파일 작성
3. CDP port 상태 확인
4. Chrome 경로 확인
5. profile directory 생성
6. CDP Chrome 중복 실행 방지
7. Codex/Claude usage page 자동 열기
8. optional monitor 1회 실행 옵션
9. README 업데이트
10. 실행 검증

---

## 3. 제외 범위

Phase-b-01에서 하지 않을 것:

- launchd 등록
- 10분마다 monitor 자동 실행
- macOS menu bar app
- Electron/Tauri app
- Chrome Extension
- Automator app 직접 생성
- Shortcuts app 직접 생성
- VPS/미니PC 운영
- parser/event/message 로직 변경
- Discord notification policy 변경

단, README에는 Automator/Shortcuts로 감싸는 방법을 간단히 적을 수 있다.

---

## 4. 핵심 사용자 흐름

목표 사용자 흐름:

1. MacBook을 켠다.
2. `Mongi Start.command`를 더블클릭한다.
3. CDP Chrome이 열린다.
4. Codex/Claude usage page가 열린다.
5. 사용자가 필요하면 로그인/보안 확인을 직접 통과한다.
6. 이후 `npm run monitor` 또는 Phase-b-02의 launchd가 monitor를 실행한다.

Phase-b-01 이후 최소 흐름:

Mongi Start.command 더블클릭
→ CDP Chrome 실행
→ Codex/Claude usage page 열림
→ CDP 연결 상태 확인 가능

---

## 5. 파일 구조 요구사항

생성 또는 수정할 파일:

- `scripts/start-cdp-chrome.sh`
- `scripts/check-cdp-status.js` 또는 동등한 script
- `scripts/print-chrome-command.js` 필요 시 수정
- `Mongi Start.command`
- `package.json`
- `README.md`

선택 파일:

- `scripts/start-mongi.sh`
- `scripts/run-monitor-once.sh`

주의:

- `.command` 파일은 실행 권한이 있어야 한다.
- shell script도 실행 권한이 있어야 한다.
- 파일명에 공백이 들어가는 경우 macOS에서 실행 가능한지 검증해야 한다.

---

## 6. package.json scripts 요구사항

추가 권장 scripts:

- `start:chrome`
- `check:cdp`
- `start:monitor-once` optional

예상:

start:chrome -> bash scripts/start-cdp-chrome.sh
check:cdp -> node scripts/check-cdp-status.js

기존 scripts 유지:

- `test:state`
- `test:discord`
- `test:scenarios`
- `debug:page-text`
- `monitor`
- `chrome:command`

---

## 7. start-cdp-chrome.sh 요구사항

`scripts/start-cdp-chrome.sh`는 CDP Chrome 실행을 담당한다.

필수 동작:

1. macOS 환경인지 확인하거나, macOS 전용임을 명확히 안내
2. Google Chrome 앱 경로 확인
3. CDP port 9222가 이미 열려 있는지 확인
4. 이미 열려 있으면 새 Chrome을 또 실행하지 않음
5. 열려 있지 않으면 CDP Chrome 실행
6. user data dir 생성
7. Codex usage URL 열기
8. Claude usage URL 열기
9. CDP 상태 확인
10. 다음에 실행할 명령 안내

기본값:

- Chrome path: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- CDP port: `9222`
- CDP URL: `http://127.0.0.1:9222`
- user data dir: `$HOME/.mongi-chrome-profile`

환경변수 override 허용:

- `CHROME_PATH`
- `CHROME_CDP_PORT`
- `CHROME_CDP_URL`
- `CHROME_USER_DATA_DIR`
- `CODEX_USAGE_URL`
- `CLAUDE_USAGE_URL`

주의:

- Webhook URL 출력 금지
- `.env` 전체 출력 금지
- Chrome 실행 실패 시 명확한 에러
- profile dir 경로 출력은 허용

---

## 8. 중복 실행 방지

CDP port가 이미 열려 있으면 Chrome을 새로 실행하지 않는다.

확인 방법 후보:

- `curl -s http://127.0.0.1:9222/json/version`
- Node script fetch
- `lsof -i :9222`

권장:

- shell script에서는 `curl` 기반으로 간단히 확인
- 더 자세한 상태는 `npm run check:cdp`에서 확인

동작:

- 이미 연결 가능하면 “Mongi CDP Chrome already running” 출력
- Codex/Claude usage page를 새 탭으로 열지 여부는 Agent가 판단
- 새 탭을 여는 경우 중복 탭이 과도하게 늘지 않도록 주의

---

## 9. usage page 열기

CDP Chrome 실행 시 다음 URL을 열어야 한다.

- Codex usage URL
- Claude usage URL

URL은 `.env` 또는 config 기본값과 맞춰야 한다.

중요:

- shell script에서 `.env`를 직접 완벽히 파싱하려고 과하게 복잡하게 만들지 않는다.
- 기본 URL을 script에 fallback으로 두고, 환경변수 override 정도만 허용한다.
- 민감 값은 없다.

---

## 10. check-cdp-status 요구사항

`npm run check:cdp`는 CDP 상태를 확인한다.

필수 동작:

1. `CHROME_CDP_URL` 또는 기본 `http://127.0.0.1:9222` 확인
2. `/json/version` 요청
3. 성공하면 browser/version 정보 일부 출력
4. 실패하면 CDP Chrome 실행 안내 출력

성공 출력 예시:

CDP Chrome is reachable.
Browser: Chrome/...
WebSocket debugger URL: available

실패 출력 예시:

CDP Chrome is not reachable.
Start it with: npm run start:chrome

주의:

- 전체 JSON을 길게 출력하지 않는다.
- 민감 정보 없음.

---

## 11. Mongi Start.command 요구사항

루트에 `Mongi Start.command` 파일을 만든다.

동작:

1. 현재 파일 위치 기준으로 프로젝트 루트 이동
2. `npm run start:chrome` 실행
3. 종료 전에 사용자에게 다음 단계 안내
4. 터미널 창이 바로 닫히지 않도록 처리 가능

예상 안내:

- CDP Chrome이 열렸는지 확인
- Codex/Claude usage page에서 로그인 상태 확인
- 필요하면 `npm run monitor` 실행
- Phase-b-02 이후에는 launchd가 monitor를 주기 실행할 예정

주의:

- `.command`는 macOS Finder 더블클릭 실행을 목표로 한다.
- 실행 권한 필요: `chmod +x "Mongi Start.command"`

---

## 12. optional monitor 1회 실행

Phase-b-01에서 starter가 monitor까지 자동 실행할지 여부는 Agent가 판단한다.

권장 기본값:

- CDP Chrome만 실행
- monitor 자동 실행은 하지 않음

이유:

- 사용자가 로그인/Turnstile 확인을 직접 해야 할 수 있음
- Chrome이 완전히 로드되기 전에 monitor가 돌면 실패할 수 있음

선택 기능:

- `START_MONITOR_AFTER_CHROME=true`일 때만 monitor 1회 실행
- 기본값 false

이 기능을 넣는다면 README에 명확히 적는다.

---

## 13. README 업데이트 요구사항

README에 Phase-b-01 사용법을 추가한다.

포함할 내용:

- 왜 CDP Chrome이 필요한지
- `npm run start:chrome`
- `Mongi Start.command` 더블클릭
- `npm run check:cdp`
- CDP Chrome이 이미 켜져 있을 때 동작
- Codex/Claude usage page에서 직접 로그인해야 할 수 있음
- `npm run monitor`
- Phase-b-02에서 launchd 자동 실행이 추가될 예정
- 문제 해결

Troubleshooting 포함:

- Chrome이 안 열린다
- 9222 포트가 안 열린다
- `check:cdp` 실패
- usage page가 로그인 화면이다
- Cloudflare/Turnstile이 다시 뜬다
- profile이 꼬였을 때 `$HOME/.mongi-chrome-profile` 삭제 후 재로그인 가능

주의:

- profile 삭제는 로그인 세션을 지우는 행동임을 명시한다.

---

## 14. 보안 주의

CDP는 로컬 브라우저 제어 통로다.

원칙:

- `127.0.0.1`에만 열어야 한다.
- 외부 네트워크에 노출하지 않는다.
- 포트를 공유기/방화벽에서 열지 않는다.
- Webhook URL을 출력하지 않는다.
- profile directory를 커밋하지 않는다.

README에 짧게 적는다.

---

## 15. 검증 명령

Agent는 작업 후 최소 아래 명령을 실행한다.

chmod +x scripts/start-cdp-chrome.sh
chmod +x "Mongi Start.command"

npm run check:cdp
npm run start:chrome
npm run check:cdp
npm run debug:page-text
npm run monitor
npm run test:state
npm run test:scenarios

Syntax checks:

node -c scripts/check-cdp-status.js

기존 JS 변경 시 해당 파일도 syntax check한다.

주의:

- 실제 Chrome 실행이 환경상 불가능하면 script syntax와 command construction을 검증하고, 사용자가 로컬에서 실행할 명령을 보고한다.
- 하지만 이번 프로젝트는 사용자의 Mac local 기준이므로 가능하면 실제 실행한다.

---

## 16. 성공 기준

Phase-b-01 완료 조건:

1. `npm run start:chrome`으로 CDP Chrome을 실행할 수 있다.
2. `npm run check:cdp`가 CDP 연결 상태를 확인한다.
3. Chrome이 이미 실행 중이면 중복 실행을 피한다.
4. Codex/Claude usage page가 열리거나 열 수 있다.
5. `Mongi Start.command`로 더블클릭 실행 가능하다.
6. 실행 권한이 설정되어 있다.
7. README에 사용법과 troubleshooting이 있다.
8. 기존 `npm run monitor` 동작이 깨지지 않는다.
9. 기존 scenario tests가 깨지지 않는다.

---

## 17. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-b-01 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. CDP starter result
- ...

6. Manual verification
- ...

7. Next recommended phase
- Phase-b-02 — launchd monitor automation

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full diagnostic logs를 붙이지 말 것.

---

## 18. 핵심 판단

Phase-b-01은 기능적으로는 작아 보이지만 실제 사용성을 크게 바꾸는 단계다.

Mongi Usage Coach가 매일 쓰이려면, 사용자가 긴 터미널 명령어를 외우면 안 된다.

이번 Phase의 성공 기준은 단순하다.

“노트북을 켜고 Mongi Start를 누르면 개발 준비 루틴이 시작되는가?”