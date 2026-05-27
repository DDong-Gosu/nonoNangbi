# phase-a-01_SPEC.md

## Phase-a-01 — Project foundation + Discord notification + state engine

## 0. 목적

Phase-a-01의 목적은 Mongi Usage Coach의 기본 실행 골격을 만든다.

이 단계에서는 Codex/Claude usage page를 아직 읽지 않는다.  
Playwright 파싱은 Phase-a-02에서 한다.

Phase-a-01은 다음 기반을 완성한다.

- Node.js 프로젝트 구조
- 환경변수 로딩
- 보안 기본 설정
- 파일 기반 state 저장소
- Discord Webhook 전송
- 메시지 템플릿 scaffold
- 로깅 시스템
- 기본 npm scripts
- README 초안

이 단계가 끝나면 `npm run test:discord`로 Discord에 테스트 메시지를 보낼 수 있고, `state.json`을 안전하게 읽고 쓸 수 있어야 한다.

---

## 1. 배경

Mongi Usage Coach는 사용자의 Codex/Claude 사용량을 감지하고, 회복/방치/사용 종료 이벤트를 Discord로 알려주는 개인용 usage coach다.

하지만 usage page 파싱은 불확실성이 크다.

따라서 먼저 확실한 기반부터 만든다.

- 알림 전송
- 상태 저장
- 설정 관리
- 로그 기록
- 보안 파일 제외
- 실행 스크립트

이 기반이 있어야 Phase-a-02에서 Playwright 파싱이 실패하더라도 전체 시스템이 무너지지 않는다.

---

## 2. 포함 범위

Phase-a-01에 포함되는 작업:

1. 프로젝트 기본 구조 생성
2. `package.json` scripts 정리
3. `.env.example` 생성
4. `.gitignore` 생성 또는 보강
5. `src/config.js` 작성
6. `src/utils/logger.js` 작성
7. `src/state/stateStore.js` 작성
8. `src/notifications/discord.js` 작성
9. `src/notifications/messages.js` scaffold 작성
10. `scripts/test-discord.js` 작성
11. `scripts/test-state.js` 작성
12. `README.md` 초안 작성
13. 기본 실행 검증

---

## 3. 제외 범위

Phase-a-01에서 하지 않을 것:

- Playwright 설치 및 usage page 접근
- Codex usage parsing
- Claude usage parsing
- event detection 전체 구현
- launchd 자동 실행
- Linux/VPS 이전
- 웹 UI
- 데이터베이스
- AI API 기반 메시지 생성
- 실제 사용량 회복/방치 판단

이 단계에서 알림은 테스트 메시지만 보내면 된다.

---

## 4. 권장 디렉토리 구조

최종 구조는 아래를 기준으로 한다.

usage-monitor/
  package.json
  .env.example
  .gitignore
  README.md
  AGENTS.md
  DESIGN.md
  MVP_SPEC.md
  src/
    config.js
    utils/
      logger.js
      random.js
      time.js
    state/
      stateStore.js
    notifications/
      discord.js
      messages.js
  scripts/
    test-discord.js
    test-state.js
  data/
    .gitkeep
  logs/
    .gitkeep
  launchd/
    .gitkeep

주의:

- `data/state.json`은 런타임에 생성한다.
- `logs/`는 커밋하지 않는 방향이 기본이지만, 폴더 유지를 위해 `.gitkeep`은 허용한다.
- `browser-profile/`은 Phase-a-02에서 생길 예정이므로 미리 gitignore에 넣는다.

---

## 5. package.json 요구사항

필수 npm scripts:

- `test:discord`
- `test:state`
- `monitor`

Phase-a-01에서 `monitor`는 아직 full monitor가 아니어도 된다.  
다만 placeholder 실행 파일이 없으면 혼란이 생기므로 최소한 명확한 안내를 출력하도록 한다.

권장 scripts 예시:

scripts:
  test:discord -> node scripts/test-discord.js
  test:state -> node scripts/test-state.js
  monitor -> node src/monitor.js

만약 `src/monitor.js`를 아직 만들지 않는다면 `monitor` script는 만들지 않아도 된다.  
단, README에 Phase-a-01 기준 실행 명령을 명확히 적어야 한다.

필수 dependencies:

- dotenv

Phase-a-01에서는 Playwright를 설치하지 않아도 된다.  
Playwright는 Phase-a-02에서 설치한다.

---

## 6. 환경변수 요구사항

`.env.example`에는 실제 값 없이 placeholder만 둔다.

필수 항목:

DISCORD_WEBHOOK_URL=
CODEX_USAGE_URL=https://chatgpt.com/codex/cloud/settings/analytics#usage
CLAUDE_USAGE_URL=https://claude.ai/settings/usage
CHECK_INTERVAL_MINUTES=10
IDLE_MINUTES_BEFORE_SUMMARY=20
WEEKLY_FULL_REMINDER_HOURS=4
QUIET_HOURS_ENABLED=true
QUIET_HOURS_START=23
QUIET_HOURS_END=8
HEADLESS=true
LOG_LEVEL=info
STATE_FILE_PATH=data/state.json

규칙:

- `.env`는 절대 커밋하지 않는다.
- Discord Webhook URL은 코드에 하드코딩하지 않는다.
- 필수 env가 없으면 명확한 에러를 출력한다.
- `test:discord` 실행 시 `DISCORD_WEBHOOK_URL`이 없으면 실패해야 한다.

---

## 7. .gitignore 요구사항

반드시 포함:

.env
.env.*
!.env.example
browser-profile/
data/state.json
logs/
*.log
node_modules/
.DS_Store

주의:

- `.env.example`은 커밋 가능해야 한다.
- `logs/` 전체를 ignore하면 `logs/.gitkeep`도 무시될 수 있다. 필요하면 예외 처리한다.
- `data/` 폴더는 유지하되 `data/state.json`은 ignore한다.

권장 예외:

!logs/.gitkeep
!data/.gitkeep

---

## 8. config.js 요구사항

`src/config.js`는 환경변수를 읽어 정규화된 config object를 반환한다.

필수 기능:

- dotenv 로드
- 숫자 env 파싱
- boolean env 파싱
- 기본값 제공
- 필수 env 검증 함수 제공
- 민감 정보는 로그에 출력하지 않음

필수 export:

- `loadConfig()`
- `requireDiscordConfig()` 또는 동등 기능

예상 config 구조:

{
  discordWebhookUrl,
  codexUsageUrl,
  claudeUsageUrl,
  checkIntervalMinutes,
  idleMinutesBeforeSummary,
  weeklyFullReminderHours,
  quietHours: {
    enabled,
    startHour,
    endHour
  },
  headless,
  logLevel,
  stateFilePath
}

주의:

- `DISCORD_WEBHOOK_URL`은 모든 실행에서 필수는 아니다.
- `test:discord`에서는 필수다.
- state test에서는 Discord Webhook이 없어도 된다.

---

## 9. logger.js 요구사항

`src/utils/logger.js`는 단순하지만 일관된 로그를 제공한다.

필수 기능:

- info
- warn
- error
- debug

로그 형식:

[2026-05-25T12:00:00.000Z] [INFO] message

요구사항:

- 객체 payload를 optional로 받을 수 있어야 한다.
- error object를 받으면 message와 stack 일부를 볼 수 있어야 한다.
- secret 값은 직접 로그하지 않는다.
- Phase-a-01에서는 파일 로그까지 필수는 아니다. console 기반이면 충분하다.

선택 기능:

- LOG_LEVEL 기반 debug 출력 제어

---

## 10. stateStore.js 요구사항

`src/state/stateStore.js`는 파일 기반 state 저장을 담당한다.

필수 기능:

- state 파일이 없으면 기본 state 생성
- state 읽기
- state 쓰기
- JSON parse 실패 시 기존 파일 백업 후 기본 state 재생성
- schema version 포함
- atomic write 또는 임시 파일을 통한 안전한 write

필수 export:

- `loadState(config)`
- `saveState(config, state)`
- `createDefaultState()`

기본 state 구조:

{
  "version": 1,
  "services": {
    "codex": {
      "shortWindowPercent": null,
      "weeklyPercent": null,
      "lastShortWindowPercent": null,
      "lastWeeklyPercent": null,
      "lastCheckedAt": null,
      "lastChangedAt": null,
      "sessionSummarySent": false,
      "lastShortRecoveredAt": null,
      "lastWeeklyRecoveredAt": null,
      "lastWeeklyFullReminderAt": null,
      "consecutiveParseFailures": 0,
      "lastParseFailureAt": null
    },
    "claude": {
      "shortWindowPercent": null,
      "weeklyPercent": null,
      "lastShortWindowPercent": null,
      "lastWeeklyPercent": null,
      "lastCheckedAt": null,
      "lastChangedAt": null,
      "sessionSummarySent": false,
      "lastShortRecoveredAt": null,
      "lastWeeklyRecoveredAt": null,
      "lastWeeklyFullReminderAt": null,
      "consecutiveParseFailures": 0,
      "lastParseFailureAt": null
    }
  }
}

주의:

- state write 중 실패하면 기존 정상 state를 최대한 보존해야 한다.
- corrupt state는 `state.json.corrupt.<timestamp>` 같은 이름으로 백업한다.
- `data/` 폴더가 없으면 자동 생성한다.

---

## 11. discord.js 요구사항

`src/notifications/discord.js`는 Discord Webhook 전송만 담당한다.

필수 기능:

- `sendDiscordMessage(config, content)` export
- content가 비어 있으면 에러
- webhook URL이 없으면 명확한 에러
- Discord 응답이 2xx가 아니면 status와 response text 일부를 포함해 에러
- fetch 사용 가능 환경이면 native fetch 사용
- Node 버전이 낮아 fetch가 없으면 Agent가 판단해 적절한 해결책 적용

메시지 전송 payload:

{
  content: "message"
}

주의:

- Webhook URL은 절대 로그하지 않는다.
- 실패 시 response body 전체를 길게 출력하지 않는다.
- Discord rate limit을 복잡하게 구현할 필요는 없다. Phase-a-01에서는 단일 테스트 전송이면 충분하다.

---

## 12. messages.js 요구사항

`src/notifications/messages.js`는 Phase-a-03에서 확장할 메시지 시스템의 scaffold다.

Phase-a-01에서는 최소한 다음을 제공한다.

- `getTestMessage()`
- `interpolateTemplate(template, variables)`
- `pickRandom(items)`

테스트 메시지 예시:

"몽! Discord Webhook 연결 성공. 이제 사용량 코치의 기본 알림 통로가 열렸어."

주의:

- 메시지 톤은 DESIGN.md를 따른다.
- 너무 과한 캐릭터성 금지.
- “몽!”은 가볍게만 사용한다.

---

## 13. test-discord.js 요구사항

`scripts/test-discord.js`는 Discord Webhook 연결을 검증한다.

동작:

1. config 로드
2. Discord Webhook 필수 env 확인
3. messages.js에서 테스트 메시지 생성
4. Discord로 전송
5. 성공/실패 로그 출력

성공 출력 예시:

[INFO] Discord test message sent successfully.

실패 출력 예시:

[ERROR] Discord test failed: DISCORD_WEBHOOK_URL is missing.

성공 기준:

- 실제 Discord 채널에 메시지가 도착한다.
- Webhook URL이 없으면 명확한 실패 메시지가 나온다.

---

## 14. test-state.js 요구사항

`scripts/test-state.js`는 state 저장소를 검증한다.

동작:

1. config 로드
2. state 로드
3. 테스트용 timestamp 또는 marker를 state에 기록
4. state 저장
5. 다시 로드
6. 값이 유지되는지 확인
7. 성공/실패 로그 출력

주의:

- 실제 이벤트 필드는 망가뜨리지 않도록 `meta` 필드를 추가해 테스트 기록을 남기는 방식을 권장한다.
- 예: `state.meta.lastStateSmokeTestAt`

성공 기준:

- `data/state.json`이 없으면 자동 생성된다.
- 다시 읽었을 때 기록한 값이 유지된다.

---

## 15. README.md 초안 요구사항

README는 인간용 설치 문서다.  
AGENTS.md와 달리 설명을 포함해도 된다.

Phase-a-01 README에 포함할 것:

- 프로젝트 한 줄 설명
- v1 목표 요약
- 현재 Phase-a-01에서 가능한 것
- 설치 명령
- `.env` 생성 방법
- Discord Webhook 설정 위치
- `npm run test:discord`
- `npm run test:state`
- 보안 주의
- 다음 Phase-a-02에서 할 일

단, README가 너무 길 필요는 없다.

---

## 16. Agent 판단권

Agent는 다음 상황에서 스스로 판단해도 된다.

- CommonJS와 ESM 중 하나 선택
- Node 버전에 따른 fetch 처리
- logger 구현 세부 방식
- atomic write 방식
- `.gitkeep` 예외 처리 방식
- `src/monitor.js` placeholder 생성 여부
- package manager는 npm 기준으로 하되, 기존 lockfile이 있으면 그것을 존중

제한:

- TypeScript로 전환하지 말 것. v1은 JavaScript로 충분하다.
- DB 추가하지 말 것.
- Web UI 만들지 말 것.
- Playwright 설치하지 말 것. Phase-a-02에서 한다.
- 테스트 프레임워크를 새로 도입하지 말 것. Phase-a-01은 script smoke test로 충분하다.

---

## 17. 검증 명령

Agent는 작업 후 최소 아래 명령을 실행한다.

npm install
npm run test:state

그리고 `.env`가 준비되어 있다면:

npm run test:discord

만약 `.env`에 Discord Webhook URL이 없어서 `test:discord`를 실행할 수 없다면, Agent는 다음을 보고한다.

- `test:discord`는 DISCORD_WEBHOOK_URL 미설정으로 실제 전송 검증 불가
- config missing env 에러가 명확히 출력되는지 확인했는지 여부

추가로 가능하면:

node -c src/config.js
node -c src/state/stateStore.js
node -c src/notifications/discord.js
node -c src/notifications/messages.js
node -c scripts/test-state.js
node -c scripts/test-discord.js

---

## 18. 성공 기준

Phase-a-01 완료 조건:

1. 기본 프로젝트 구조가 생성되어 있다.
2. `.env.example`이 있다.
3. `.gitignore`가 민감 파일을 막는다.
4. config loader가 환경변수를 정규화한다.
5. stateStore가 `data/state.json`을 생성/읽기/쓰기 할 수 있다.
6. corrupt state에 대한 방어가 있다.
7. Discord Webhook client가 구현되어 있다.
8. test-discord script가 있다.
9. test-state script가 있다.
10. messages scaffold가 있다.
11. README 초안이 있다.
12. `npm run test:state`가 통과한다.
13. 가능하면 `npm run test:discord`로 실제 Discord 메시지 전송이 검증된다.

---

## 19. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-a-01 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Manual verification
- ...

6. Next recommended phase
- Phase-a-02 — Playwright login/session + usage extraction strategy

주의:

- Discord Webhook URL을 보고에 포함하지 말 것.
- `.env` 내용을 붙여넣지 말 것.
- full state dump를 붙여넣지 말 것.
- 필요한 경우 state 구조 요약만 보고할 것.

---

## 20. 핵심 판단

Phase-a-01은 작아 보이지만 중요하다.

여기서 좋은 기반을 만들면 이후 Phase-a-02에서 usage page 파싱이 실패하거나 페이지 구조가 바뀌어도, 알림/상태/로그 시스템은 그대로 유지된다.

이번 단계의 목표는 “멋진 기능”이 아니라 “무너지지 않는 골격”이다.