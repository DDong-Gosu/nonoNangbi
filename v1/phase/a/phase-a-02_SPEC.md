# phase-a-02_SPEC.md

## Phase-a-02 — Playwright login/session + usage extraction strategy

## 0. 목적

Phase-a-02의 목적은 Mongi Usage Coach가 Codex/Claude usage page에 접근하고, 사용량 정보를 추출할 수 있는 기반을 만드는 것이다.

이 단계의 핵심은 “완벽한 파싱”이 아니라 다음이다.

1. Playwright 로그인 세션 저장
2. Codex/Claude usage page 접근
3. 페이지에서 사용량 관련 정보를 추출하는 전략 수립
4. 서비스별 parser 구조 생성
5. 파싱 성공/실패를 표준 result object로 반환
6. 실패 시 원인을 진단할 수 있는 로그/디버그 파일 생성

이 단계가 끝나면 `npm run login`, `npm run debug:page-text`, `npm run monitor` 또는 이에 준하는 명령으로 usage page 접근과 extraction 결과를 확인할 수 있어야 한다.

---

## 1. 배경

Phase-a-01에서는 config, state, Discord, logger, message scaffold가 만들어졌다.

Phase-a-02에서는 그 기반 위에 Playwright를 추가한다.

Codex/Claude usage page는 공식 API가 아니라 웹 UI 기반이다.  
따라서 다음 리스크가 있다.

- 로그인 세션 만료
- headless 모드 접근 실패
- body.innerText에 퍼센트가 안 잡힘
- progress bar가 텍스트가 아니라 DOM/SVG로 렌더링됨
- Codex와 Claude의 usage page 구조가 서로 다름
- UI 변경으로 parser가 깨짐

따라서 Agent는 한 가지 방법만 시도하고 멈추면 안 된다.  
가장 단순한 방법부터 실행하고, 실패하면 대안을 시도해야 한다.

---

## 2. 포함 범위

Phase-a-02에 포함되는 작업:

1. Playwright 설치
2. `scripts/login.js` 작성
3. `scripts/debug-page-text.js` 작성
4. `src/services.js` 또는 동등한 service registry 작성
5. `src/parsers/codexParser.js` 작성
6. `src/parsers/claudeParser.js` 작성
7. `src/parsers/common.js` 또는 동등한 parser utility 작성
8. `src/extractors/usageExtractor.js` 또는 동등한 Playwright extraction module 작성
9. `src/monitor.js`를 최소 monitor로 연결
10. extraction result를 로그로 출력
11. parse result를 state에 반영할 수 있는 최소 연결
12. diagnostic artifact 저장
13. README 업데이트
14. Phase-a-01 smoke tests 재검증

---

## 3. 제외 범위

Phase-a-02에서 하지 않을 것:

- 100% 회복 알림 구현
- session stopped 알림 구현
- weekly idle 알림 구현
- launchd 자동 실행
- VPS 이전
- AI 생성 메시지
- 웹 대시보드
- 복잡한 테스트 프레임워크
- OCR 기반 추출

주의:

OCR은 마지막 수단이다. Phase-a-02에서는 기본적으로 사용하지 않는다.

---

## 4. 보완 요구사항 from Phase-a-01

Phase-a-02 시작 전에 Agent는 다음을 확인한다.

1. `npm run test:state`가 여전히 통과하는지 확인
2. `.env`가 있으면 `npm run test:discord`로 실제 Discord Webhook 작동 확인
3. `.env`가 없거나 Webhook URL이 없으면 명확히 보고
4. Playwright 설치 후에도 Phase-a-01의 smoke tests가 깨지지 않는지 재확인

이 확인은 Phase-a-02 완료 보고에 포함한다.

---

## 5. package.json 요구사항

추가 dependency:

- playwright

추가 scripts:

- `login`
- `debug:page-text`
- `monitor`

권장 scripts:

login -> node scripts/login.js
debug:page-text -> node scripts/debug-page-text.js
monitor -> node src/monitor.js

필요하면 다음도 허용:

debug:codex -> node scripts/debug-page-text.js codex
debug:claude -> node scripts/debug-page-text.js claude

---

## 6. browser-profile 정책

Playwright persistent context를 사용한다.

기본 profile 경로:

browser-profile/

규칙:

- `browser-profile/`은 gitignore 되어 있어야 한다.
- 로그인 세션은 이 폴더에 저장한다.
- `scripts/login.js`는 headless false로 실행한다.
- 사용자가 직접 로그인할 수 있도록 브라우저를 띄운다.
- 로그인 완료 후 사용자가 터미널에서 종료할 수 있게 안내한다.

로그인 스크립트 동작:

1. config 로드
2. Playwright persistent context 실행
3. Codex URL 또는 Claude URL 열기
4. 사용자가 로그인할 수 있도록 headless false
5. 종료 안내 출력

권장:

- 기본적으로 Codex와 Claude 페이지를 둘 다 탭으로 연다.
- CLI 인자로 특정 서비스만 열 수 있으면 더 좋다.

---

## 7. service registry 요구사항

서비스별 설정을 중앙에서 관리한다.

예상 service object:

{
  key: "codex",
  name: "Codex",
  usageUrl: config.codexUsageUrl,
  parser: parseCodexUsage
}

{
  key: "claude",
  name: "Claude",
  usageUrl: config.claudeUsageUrl,
  parser: parseClaudeUsage
}

규칙:

- Codex와 Claude 로직을 한 parser에 섞지 않는다.
- 하나의 서비스가 실패해도 다른 서비스는 계속 실행한다.
- service enabled flag는 지금은 선택사항이지만 구조상 추가 가능해야 한다.

---

## 8. extraction strategy

Agent는 다음 순서로 extraction을 시도한다.

### 8.1 1차: body.innerText

가장 먼저 시도한다.

추출 대상:

- body.innerText 전체
- percent-like tokens
- usage/reset/window 관련 주변 문맥

장점:

- 단순함
- 유지보수 쉬움

실패 조건:

- 퍼센트가 없음
- usage 관련 문맥이 없음
- 로그인 페이지 텍스트만 나옴
- 접근 제한/에러 페이지

### 8.2 2차: DOM selector exploration

innerText가 부족하면 DOM을 탐색한다.

시도 대상:

- [aria-label]
- [role="progressbar"]
- progress elements
- SVG 주변 텍스트
- button/card/list text
- data attributes if visible

주의:

- 클래스명 기반 selector는 불안정할 수 있으므로 가능하면 semantic selector 우선
- 그래도 실제 페이지에서 필요한 경우 클래스 탐색 가능

### 8.3 3차: accessibility snapshot

Playwright accessibility snapshot 또는 동등한 접근성 기반 정보를 사용한다.

목적:

- 시각적으로 보이는 usage 값이 accessibility tree에 노출되는지 확인

### 8.4 4차: headless false comparison

headless true에서 안 되고 headless false에서 되면 로그인/탐지/렌더링 차이를 의심한다.

Agent는 필요하면 HEADLESS=false 설정으로 비교한다.

### 8.5 degraded mode

파싱이 안 되더라도 monitor 전체가 실패하면 안 된다.

반환 result는 실패 상태로 표준화한다.

---

## 9. parse result 표준

각 parser 또는 extractor는 다음 형태의 normalized result를 반환한다.

{
  serviceKey: "codex",
  serviceName: "Codex",
  ok: true,
  shortWindowPercent: 100,
  weeklyPercent: 92,
  parseMethod: "innerText",
  parseConfidence: "medium",
  rawTextSample: "...",
  parsedAt: "2026-05-25T12:00:00.000Z",
  errorReason: null
}

실패 예시:

{
  serviceKey: "claude",
  serviceName: "Claude",
  ok: false,
  shortWindowPercent: null,
  weeklyPercent: null,
  parseMethod: "innerText",
  parseConfidence: "none",
  rawTextSample: "...",
  parsedAt: "2026-05-25T12:00:00.000Z",
  errorReason: "login_required_or_usage_text_not_found"
}

필수 필드:

- serviceKey
- serviceName
- ok
- shortWindowPercent
- weeklyPercent
- parseMethod
- parseConfidence
- rawTextSample
- parsedAt
- errorReason

---

## 10. parser policy

### 10.1 Codex parser

`src/parsers/codexParser.js`

역할:

- Codex usage page에서 추출한 text/DOM candidates를 받아 shortWindowPercent와 weeklyPercent를 찾아낸다.
- Codex 특화 라벨을 사용할 수 있다.
- 단, hardcoded English/Korean UI 문구에만 의존하지 않는다.

가능한 힌트:

- 5h
- 5 hour
- five hour
- short
- weekly
- week
- usage
- percent
- reset

### 10.2 Claude parser

`src/parsers/claudeParser.js`

역할:

- Claude usage page에서 추출한 text/DOM candidates를 받아 사용량 percent를 찾아낸다.
- Claude의 구독/usage UI가 Codex와 다를 수 있음을 전제로 한다.

가능한 힌트:

- usage
- limit
- weekly
- reset
- remaining
- percent
- Claude Code

주의:

- Claude가 5시간/weekly를 같은 방식으로 노출하지 않을 수 있다.
- 이 경우 찾은 값을 confidence 낮게 표시하거나 null로 둔다.

---

## 11. debug-page-text script 요구사항

`scripts/debug-page-text.js`는 usage page의 실제 텍스트 추출 상태를 확인하기 위한 도구다.

동작:

1. config 로드
2. browser-profile로 persistent context 실행
3. 서비스 URL 접속
4. body.innerText 추출
5. percent-like tokens 추출
6. usage 관련 후보 문장 추출
7. diagnostic file 저장
8. summary 로그 출력

CLI 사용 예시:

npm run debug:page-text
npm run debug:page-text -- codex
npm run debug:page-text -- claude

diagnostic 저장 위치:

logs/debug-codex-text.txt
logs/debug-claude-text.txt
logs/debug-codex-summary.json
logs/debug-claude-summary.json

주의:

- 로그/diagnostic은 gitignore 되어야 한다.
- full page text에 민감 정보가 있을 수 있으므로 완료 보고에 전체 내용을 붙이지 않는다.
- 파일에 저장은 허용하지만 Git commit은 금지.

---

## 12. monitor.js Phase-a-02 역할

Phase-a-02의 `src/monitor.js`는 아직 full event monitor가 아니다.

역할:

1. config 로드
2. state 로드
3. Playwright로 각 service usage page 접근
4. extractor 실행
5. parser result 출력
6. 성공한 percent를 state에 최소 반영
7. 실패한 서비스는 consecutiveParseFailures 증가
8. state 저장
9. 전체 결과 summary 출력

아직 Discord event 알림은 보내지 않는다.  
단, fatal diagnostic을 Discord로 보내는 기능은 Phase-a-03 이후로 미룬다.

---

## 13. state update policy

Phase-a-02에서 parse result를 state에 반영한다.

성공 시:

- lastShortWindowPercent = 기존 shortWindowPercent
- lastWeeklyPercent = 기존 weeklyPercent
- shortWindowPercent = result.shortWindowPercent
- weeklyPercent = result.weeklyPercent
- lastCheckedAt = now
- consecutiveParseFailures = 0
- lastParseFailureAt = null

주의:

- result.shortWindowPercent가 null이면 기존 값을 무조건 덮어쓰지 않는다.
- result.weeklyPercent가 null이면 기존 값을 무조건 덮어쓰지 않는다.
- null로 덮어써서 이전 유효 usage를 잃지 않게 한다.

실패 시:

- lastCheckedAt = now
- consecutiveParseFailures += 1
- lastParseFailureAt = now
- 기존 percent 값은 보존

---

## 14. 로그인 상태 감지

다음 상황은 로그인 필요 또는 세션 문제로 분류한다.

- URL이 login/auth 페이지로 이동
- body text에 sign in/log in/authentication 관련 문구가 많음
- usage 관련 텍스트가 전혀 없고 login 관련 텍스트가 있음
- HTTP/navigation은 성공했지만 계정 페이지가 안 보임

errorReason 예시:

- login_required
- page_timeout
- usage_text_not_found
- percent_not_found
- parser_low_confidence
- unknown_page_structure

---

## 15. README 업데이트 요구사항

README에 다음 내용을 추가한다.

- Playwright 설치 완료 후 해야 할 일
- `npm run login`
- Codex/Claude 로그인 방법
- `npm run debug:page-text`
- diagnostic 파일 위치
- `npm run monitor`
- headless 실패 시 `.env`에서 HEADLESS=false로 바꾸는 방법
- 파싱 실패 시 확인할 것
- Discord 알림 이벤트는 Phase-a-03에서 추가된다는 설명

---

## 16. Agent 판단권

Agent는 다음을 스스로 판단해도 된다.

- extractor module 이름과 구조
- parser common utility 구조
- percent candidate 추출 방식
- diagnostic summary format
- CLI 인자 처리 방식
- Playwright timeout 값
- headless true/false 비교 필요 여부
- `monitor.js`에서 어느 정도까지 state를 갱신할지

제한:

- 이벤트 알림 구현은 하지 않는다.
- session stopped/weekly idle 판단을 하지 않는다.
- AI API를 붙이지 않는다.
- OCR을 붙이지 않는다.
- 브라우저 프로필이나 로그를 커밋하지 않는다.
- 파싱 실패를 성공처럼 보고하지 않는다.

---

## 17. 검증 명령

Agent는 작업 후 최소 아래 명령을 실행한다.

npm install
npm run test:state
npm run test:discord
npm run login
npm run debug:page-text
npm run monitor

단, `npm run login`은 사용자의 수동 로그인이 필요할 수 있다.  
Agent 환경에서 브라우저 로그인이 불가능하면 다음을 해야 한다.

- login script syntax 검증
- headless false 실행 가능 여부 확인
- 사용자가 로컬에서 실행해야 할 정확한 명령 안내
- debug/monitor가 로그인 세션 없을 때 명확히 실패하는지 확인

추가 syntax check:

node -c scripts/login.js
node -c scripts/debug-page-text.js
node -c src/monitor.js
node -c src/parsers/codexParser.js
node -c src/parsers/claudeParser.js

---

## 18. 성공 기준

Phase-a-02 완료 조건:

1. Playwright가 설치되어 있다.
2. `npm run login` script가 있다.
3. `browser-profile/` 기반 persistent session 구조가 있다.
4. `npm run debug:page-text` script가 있다.
5. Codex/Claude 서비스별 usage URL 접근을 시도한다.
6. Codex/Claude parser가 분리되어 있다.
7. parser result가 표준 object로 반환된다.
8. parsing 실패 시 diagnostic log/file이 생성된다.
9. 한 서비스 실패가 전체 monitor를 중단시키지 않는다.
10. `npm run test:state`가 계속 통과한다.
11. Discord smoke test가 가능하면 통과한다.
12. `npm run monitor`가 최소한 parse result 또는 명확한 failure summary를 출력한다.
13. README가 업데이트되어 있다.

---

## 19. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-a-02 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Extraction results
- Codex: success/failure, parse method, confidence, percent fields found
- Claude: success/failure, parse method, confidence, percent fields found

6. Diagnostic artifacts
- ...

7. Manual verification
- ...

8. Next recommended phase
- Phase-a-03 — Event detection + Mongi random notification system

주의:

- Discord Webhook URL을 보고하지 말 것.
- full page text를 붙여넣지 말 것.
- cookies/session data를 보고하지 말 것.
- browser-profile 내용을 보고하지 말 것.

---

## 20. 핵심 판단

Phase-a-02의 성공은 “무조건 usage percent를 완벽히 뽑았다”가 아니다.

성공의 기준은 다음이다.

- 실제 usage page 접근 경로가 생겼는가?
- 로그인 세션 저장 구조가 생겼는가?
- Codex/Claude parser가 분리되었는가?
- 파싱 성공/실패를 표준화했는가?
- 실패했을 때 다음에 무엇을 고쳐야 하는지 알 수 있는 diagnostic이 남는가?

웹 UI scraping은 불안정하다.  
그러므로 Phase-a-02는 “정확도”와 함께 “진단 가능성”을 반드시 확보해야 한다.