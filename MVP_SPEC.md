# MVP_SPEC.md — Mongi Usage Coach v1

## 0. 문서 목적

이 문서는 Mongi Usage Coach v1의 SSOT이다.

Mongi Usage Coach는 Codex와 Claude의 사용량을 감지하고, 회복/방치/사용 종료 시점에 Discord로 알림을 보내는 개인용 usage monitoring system이다.

이 문서는 단순 기능 명세서가 아니다.  
왜 이 도구를 만드는지, 어떤 제품 컨셉을 가져갈지, 어떤 기술 구조로 만들지, 그리고 production v1에 가까운 개인용 운영 상태까지 어떤 순서로 구현할지를 함께 정의한다.

각 Phase의 세부 구현 명세는 이후 별도 문서로 작성한다.

예상 후속 문서:

- phase-a-01_SPEC.md
- phase-a-02_SPEC.md
- phase-a-03_SPEC.md
- phase-b-01_SPEC.md
- phase-b-02_SPEC.md
- phase-b-03_SPEC.md
- phase-c-01_SPEC.md
- phase-c-02_SPEC.md
- phase-c-03_SPEC.md

---

## 1. 제품 한 줄 정의

Mongi Usage Coach는 내가 결제한 Codex와 Claude 구독료가 실제 개발 산출물로 전환되도록, 사용량 회복·방치·세션 종료 시점을 감지해 Discord로 행동 유도 메시지를 보내는 개인용 AI 사용량 코치다.

---

## 2. 왜 만드는가

사용자는 현재 Codex와 Claude의 가장 낮은 유료 요금제를 각각 결제하고 있다.

월 비용은 약 6만원 수준이다.  
사용자는 아직 고정 수입이 없는 대학생이며, 개발 역량을 빠르게 키워 취업/수익화/미래 준비를 해야 하는 상황이다.

따라서 이 도구의 핵심 목적은 단순한 알림이 아니다.

핵심 목적은 다음이다.

1. 구독료 낭비 방지
2. Codex/Claude 사용량 회복 시점 포착
3. 주간 사용량이 방치될 때 행동 압박 제공
4. 사용 종료 시점에 남은 사용량 요약
5. 개발을 다시 시작하게 만드는 정서적/행동적 트리거 제공
6. “돈을 쓰고 있다”는 사실을 “실제 개발 산출물”로 연결

이 제품은 타인에게 판매할 SaaS가 아니다.  
우선순위는 확장성보다 실제 작동, 안정성, 개인 효용이다.

---

## 3. 핵심 문제 정의

### 3.1 현재 문제

Codex와 Claude는 강력한 개발 도구지만, 사용량 제한이 있고 사용량 회복 주기가 존재한다.  
그러나 사용자는 다음을 실시간으로 관리하기 어렵다.

- 지금 5시간 기준 사용량이 얼마나 남았는지
- 주간 사용량이 얼마나 남았는지
- 사용량이 100%로 회복됐는지
- 주간 사용량이 계속 100%로 방치되고 있는지
- 사용을 멈췄을 때 남은 사용량이 어느 정도인지
- 지금 다시 개발을 시작해야 할 타이밍인지

결과적으로 결제는 하지만 사용하지 않는 시간이 생긴다.  
이건 사용자의 현재 상황에서는 명확한 비용 낭비다.

### 3.2 해결 방식

Mongi Usage Coach는 usage page 또는 가능한 사용량 노출 지점을 주기적으로 확인한다.

그 다음 이전 상태와 비교해 다음 이벤트를 판단한다.

- 사용량 감소: 사용 중으로 판단
- 사용량 무변화 지속: 사용 종료/휴식으로 판단
- 100% 회복: 다시 사용 가능 상태로 판단
- weekly 100% 장시간 유지: 결제분 미사용 방치로 판단

이벤트가 발생하면 Discord Webhook으로 메시지를 보낸다.

---

## 4. 브랜드 / 캐릭터 컨셉

## 4.1 이름

서비스 이름: Mongi Usage Coach  
캐릭터 이름: 몽이

## 4.2 캐릭터 역할

몽이는 사용자를 감시하거나 비난하는 캐릭터가 아니다.  
몽이는 사용자가 더 나은 어른이 되도록 돕는 개인용 개발 습관 코치다.

사용자는 대학생이고, 빠르게 역량을 키워 돈을 벌고, 사랑하는 사람과 안정적인 미래를 만들고 싶어 한다.  
몽이는 이 목표를 잊지 않게 해주는 조용하지만 단호한 친구다.

## 4.3 톤

몽이의 메시지는 다음 성격을 가진다.

- 다정하지만 흐물흐물하지 않음
- 응원하지만 현실을 회피하지 않음
- “몽!” 같은 캐릭터성은 있으나 과하지 않음
- 개발 행동으로 이어지게 만드는 문장
- 고정 문구가 아니라 살아있는 느낌
- 때로는 격려, 때로는 압박, 때로는 짧은 체크인

## 4.4 메시지 예시

회복 알림:

- 🔋 몽! Codex 5시간 한도가 100%로 회복됐어. 새 탄창 장전 완료. 지금 25분만 써도 오늘은 앞으로 간다.
- 몽이가 알려줌. Claude가 다시 100%야. 크게 벌리지 말고 작은 작업 하나만 닫자.
- 지금 열렸다. Codex 100%. 오늘의 목표는 완벽한 앱이 아니라 작동하는 한 조각이다.

주간 방치 알림:

- 몽. Claude 주간 사용량이 아직 100%야. 이건 여유가 아니라 미사용이야. 30분만 써서 결제분을 산출물로 바꾸자.
- 주간 한도가 그대로야. 냉정하게 말하면 지금은 돈이 시간으로 새고 있음. 작은 버그 하나라도 잡자.
- 몽이가 찌른다. 이번 주 Claude를 거의 안 썼다. 미래를 바꾸려면 오늘 25분은 써야 한다.

사용 종료 요약:

- 사용이 멈춘 것 같아. Codex 5시간 한도 {shortPercent}%, 주간 {weeklyPercent}% 남음. 괜찮아. 다음 진입 때 할 일을 하나만 정해두자.
- 몽 체크. 방금 세션은 멈춘 듯. 남은 한도는 충분함. 다음엔 “큰 기능” 말고 “작은 마감”으로 들어가자.

---

## 5. 제품 원칙

## 5.1 실제 작동이 우선이다

이 제품은 예쁜 대시보드가 목적이 아니다.  
정확히 감지하고, 적절한 시점에 알림을 보내고, 사용자가 다시 개발하게 만들면 성공이다.

## 5.2 무료 운영을 우선한다

추가 비용이 들면 목적이 약해진다.

우선순위:

1. Mac local + launchd
2. 무료 클라우드/서버리스 가능성 검토
3. Oracle Cloud Free Tier 같은 무료 VPS
4. 유료 VPS는 최후 옵션

## 5.3 Agent는 단순 구현자가 아니라 실행자다

Agent는 스펙에 적힌 방법만 기계적으로 구현하지 않는다.

Agent는 다음을 수행해야 한다.

- 먼저 가장 단순하고 안정적인 방법을 시도
- 실제 실행
- 로그 확인
- 실패 원인 파악
- 대안 시도
- 작동 검증
- 최종 결과 보고

예를 들어 usage page에서 innerText로 퍼센트가 잡히지 않으면 Agent는 멈추지 않는다.

대안 순서:

1. innerText 기반 파싱
2. DOM selector 탐색
3. accessibility snapshot
4. screenshot 기반 수동 분석 보조
5. headless false 모드 확인
6. 서비스별 파서 분리
7. 해당 서비스 임시 disable 처리 후 나머지 기능 완성

## 5.4 보안 우선

Discord Webhook URL, 로그인 세션, 쿠키, 환경변수는 절대 GitHub에 올라가면 안 된다.

필수:

- .env는 gitignore
- browser-profile은 gitignore
- state.json은 민감도 낮지만 기본적으로 gitignore 권장
- logs는 gitignore
- webhook URL은 코드에 하드코딩 금지

## 5.5 과도한 기능 금지

v1에서 하지 않을 것:

- 웹 대시보드
- 모바일 앱
- 데이터베이스 서버
- 사용자 계정
- 여러 사용자 지원
- AI API 기반 실시간 문구 생성
- 복잡한 통계 분석
- 결제/배포용 SaaS 구조

---

## 6. v1 성공 기준

v1은 다음 조건을 만족하면 성공이다.

1. Codex usage page에 접근하고 사용량 정보를 읽거나, 최소한 파싱 실패를 명확히 로그로 남긴다.
2. Claude usage page에 접근하고 사용량 정보를 읽거나, 최소한 파싱 실패를 명확히 로그로 남긴다.
3. 이전 상태를 state.json에 저장한다.
4. 사용량이 100%로 회복되면 Discord 알림을 보낸다.
5. 사용량 감소 후 20분 이상 변화가 없으면 세션 종료 요약 알림을 보낸다.
6. weekly usage가 100%로 장시간 유지되면 주기적으로 사용 유도 알림을 보낸다.
7. 메시지는 상황별 템플릿에서 랜덤 선택된다.
8. Mac launchd로 주기 실행된다.
9. 로그를 통해 실패 원인을 확인할 수 있다.
10. Mac에서 검증 후 무료 상시 실행 환경으로 이전할 수 있는 구조를 가진다.

---

## 7. 주요 사용자 시나리오

## 7.1 Codex 100% 회복

상황:

- 이전 체크에서 Codex short window usage가 74%
- 현재 체크에서 100%
- 또는 weekly usage가 100%로 회복

동작:

- Discord에 회복 알림 전송
- 메시지는 recoveredShort 또는 recoveredWeekly 템플릿에서 랜덤 선택
- state.json 업데이트

## 7.2 사용 중 상태

상황:

- 이전 체크보다 현재 usage percent가 감소

동작:

- 사용 중으로 판단
- 알림 보내지 않음
- lastChangedAt 업데이트
- sessionSummarySent false로 리셋

## 7.3 사용 종료 상태

상황:

- 마지막 사용량 감소 이후 20분 이상 변화 없음
- sessionSummarySent가 false

동작:

- Discord에 사용 종료 요약 전송
- 현재 short window percent와 weekly percent 포함
- sessionSummarySent true로 변경

## 7.4 weekly 100% 방치

상황:

- weekly percent가 100%
- 최근 4시간 이상 weekly 사용량 변화 없음
- quiet hours가 아니거나 quiet hours 설정이 꺼져 있음

동작:

- Discord에 weekly idle 메시지 전송
- 메시지는 약간 압박감 있게 작성
- lastWeeklyFullReminderAt 업데이트

## 7.5 파싱 실패

상황:

- usage page에 접속했지만 percent 값을 읽지 못함

동작:

- Discord에 매번 알림 보내지 않음
- 로그에는 명확히 남김
- 연속 실패 횟수가 기준 이상이면 diagnostic 메시지 1회 전송 가능
- 해당 서비스만 degraded 상태로 처리
- 다른 서비스 감시는 계속 진행

---

## 8. 기술 구조

## 8.1 런타임

- Node.js
- Playwright
- dotenv
- file-based state
- Discord Webhook
- Mac launchd
- 추후 Linux cron 이전 가능

## 8.2 디렉토리 구조

usage-monitor/
  package.json
  .env
  .gitignore
  README.md
  AGENTS.md
  DESIGN.md
  MVP_SPEC.md
  src/
    monitor.js
    config.js
    services.js
    parsers/
      codexParser.js
      claudeParser.js
    state/
      stateStore.js
    notifications/
      discord.js
      messages.js
    utils/
      time.js
      logger.js
      random.js
  scripts/
    login.js
    test-discord.js
    debug-page-text.js
  launchd/
    com.donghoon.mongi-usage-coach.plist.example
  data/
    state.json
  logs/
    out.log
    error.log
  browser-profile/

## 8.3 환경변수

.env.example에 포함할 값:

DISCORD_WEBHOOK_URL=
CODEX_USAGE_URL=
CLAUDE_USAGE_URL=
CHECK_INTERVAL_MINUTES=10
IDLE_MINUTES_BEFORE_SUMMARY=20
WEEKLY_FULL_REMINDER_HOURS=4
QUIET_HOURS_ENABLED=true
QUIET_HOURS_START=23
QUIET_HOURS_END=8
HEADLESS=true

.env는 실제 값 저장.

## 8.4 상태 저장

state.json 예시:

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

## 8.5 서비스별 usage 모델

공통 필드:

- serviceKey: codex 또는 claude
- serviceName: Codex 또는 Claude
- shortWindowPercent: 5시간 또는 단기 사용량 기준
- weeklyPercent: 주간 사용량 기준
- rawTextSample: 디버깅용 일부 텍스트
- parsedAt: 파싱 시각
- parseConfidence: high, medium, low
- parseMethod: innerText, selector, accessibility, manualFallback

주의:

Codex와 Claude는 usage page 구조가 다를 수 있다.  
따라서 파서는 반드시 서비스별로 분리한다.

---

## 9. 감지 정책

## 9.1 사용 중 판단

조건:

- shortWindowPercent가 이전보다 감소했거나
- weeklyPercent가 이전보다 감소했거나
- 둘 중 하나라도 유의미하게 감소

동작:

- using 상태로 간주
- lastChangedAt 갱신
- sessionSummarySent false
- 알림 없음

## 9.2 회복 판단

short recovered:

- 이전 shortWindowPercent < 100
- 현재 shortWindowPercent === 100

weekly recovered:

- 이전 weeklyPercent < 100
- 현재 weeklyPercent === 100

동작:

- recovered 메시지 전송
- lastShortRecoveredAt 또는 lastWeeklyRecoveredAt 저장

중복 방지:

- 같은 회복 이벤트는 상태 변화 없이 반복 발송 금지

## 9.3 세션 종료 판단

조건:

- lastChangedAt 존재
- 현재 시각 - lastChangedAt >= idleMinutesBeforeSummary
- sessionSummarySent === false
- 현재 사용량이 직전 체크와 동일
- 최소 한 번 이상 사용량 감소가 있었음

동작:

- sessionStopped 메시지 전송
- shortWindowPercent, weeklyPercent 포함
- sessionSummarySent true

## 9.4 weekly idle 판단

조건:

- weeklyPercent === 100
- lastWeeklyFullReminderAt이 없거나 현재 시각과 4시간 이상 차이
- quiet hours가 아님
- 해당 서비스 enabled

동작:

- weeklyIdle 메시지 전송
- lastWeeklyFullReminderAt 갱신

주의:

weekly 100%는 “여유”가 아니라 “미사용”일 수 있다.  
메시지는 너무 자책시키지는 않되, 돈이 새고 있다는 현실을 분명히 전달한다.

## 9.5 quiet hours

기본값:

- 23:00 ~ 08:00 알림 차단

quiet hours 중에도 허용할 수 있는 알림:

- 없음

단, 로그 기록과 state 업데이트는 계속 수행한다.

---

## 10. 메시지 시스템

## 10.1 메시지 카테고리

messages.js는 다음 카테고리를 제공한다.

- recoveredShort
- recoveredWeekly
- sessionStopped
- weeklyIdle
- parseFailureDigest
- dailyAlive optional

## 10.2 템플릿 수량

v1 목표:

- recoveredShort: 최소 15개
- recoveredWeekly: 최소 15개
- sessionStopped: 최소 15개
- weeklyIdle: 최소 25개
- parseFailureDigest: 최소 5개

## 10.3 템플릿 변수

사용 가능한 변수:

- {serviceName}
- {shortWindowPercent}
- {weeklyPercent}
- {idleMinutes}
- {reminderHours}
- {time}
- {date}
- {suggestedAction}

## 10.4 메시지 톤 가이드

좋은 메시지:

- 몽! {serviceName}가 100%로 회복됐어. 지금은 크게 벌릴 시간 말고 작게 닫을 시간.
- {serviceName} 주간 한도가 아직 100%야. 이건 아껴둔 게 아니라 아직 못 바꾼 에너지야. 25분만 쓰자.
- 사용이 멈춘 것 같아. 남은 한도는 short {shortWindowPercent}%, weekly {weeklyPercent}%. 다음 진입은 작은 마감 하나로 가자.

나쁜 메시지:

- 너는 왜 이렇게 게으르니?
- 당장 개발 안 하면 망한다.
- 완벽한 서비스를 만들어라.
- 의미 없는 과장된 자기계발 문구

---

## 11. 운영 방식

## 11.1 로컬 운영

초기 운영은 Mac local에서 한다.

- scripts/login.js로 로그인 세션 저장
- monitor 실행 테스트
- Discord 테스트
- launchd 등록
- 10분마다 실행

## 11.2 무료 상시 운영 후보

Mac이 꺼져도 감지하려면 무료 상시 실행 환경이 필요하다.

우선 후보:

1. Oracle Cloud Free Tier VPS
2. 기타 무료 VM
3. GitHub Actions cron

판단:

- GitHub Actions는 브라우저 로그인 세션 유지가 불안정할 수 있어 우선순위 낮음
- Render 무료 cron은 환경 유지와 Playwright 실행이 애매할 수 있음
- Oracle Cloud Free Tier가 가장 적합하지만 계정 생성/서버 설정 비용이 있음

v1에서는 로컬에서 완성하고, 이후 phase-c에서 무료 VPS 이전 가능성을 검증한다.

---

## 12. Agent 작업 철학

이 프로젝트에서 Agent는 “코드 타이핑 도구”가 아니다.  
Agent는 목표 달성을 위해 실행하고 검증하는 작업자다.

Agent는 다음 루프를 따라야 한다.

1. Spec 읽기
2. 현재 파일 구조 확인
3. 가장 단순한 구현 경로 선택
4. 코드 작성
5. 실제 명령 실행
6. 로그 확인
7. 실패 시 원인 분류
8. 대안 시도
9. 성공 조건 검증
10. 변경 파일과 검증 결과 보고

Agent가 하면 안 되는 것:

- 실행하지 않고 “될 것 같다”고 보고
- 환경변수나 토큰을 코드에 하드코딩
- 파싱 실패를 조용히 무시
- 한 서비스 실패 때문에 전체 모니터 종료
- 사용자의 의도와 다른 대규모 리팩토링
- 대시보드/DB/서버 같은 불필요한 확장

---

## 13. Phase 계획

## Phase-a — Core local monitor engine

목표:

Mac local 환경에서 Codex/Claude usage page를 읽고, 사용량 의미를 정규화한 뒤, 이벤트를 판단해 Discord로 몽이 알림을 보내는 핵심 엔진을 완성한다.

Phase-a는 Mongi Usage Coach의 심장부다.  
이 단계가 끝나면 사용자는 수동으로 CDP Chrome을 켜고 `npm run monitor`를 실행해 실제 usage coaching을 받을 수 있어야 한다.

### Phase-a-01 — Project foundation + Discord notification + state engine

목표:

프로젝트 기본 구조, 환경변수, 로그, state 저장소, Discord Webhook 전송 기반을 만든다.

완료 기준:

- `.env.example` 존재
- `.gitignore`가 민감 파일 보호
- `data/state.json` 생성/읽기/쓰기 가능
- Discord Webhook smoke test 가능
- Playwright는 아직 설치하지 않음

상태:

완료.

### Phase-a-02 — Playwright extraction + CDP browser connection

목표:

Codex/Claude usage page에 접근하고 사용량 정보를 추출한다.

초기에는 Playwright persistent browser를 시도했지만 Cloudflare Turnstile에 막혔다.  
따라서 정상 Chrome을 사용자가 직접 CDP 모드로 실행하고, 앱은 해당 Chrome에 연결해 페이지를 읽는 방식으로 수정했다.

완료 기준:

- Playwright 설치
- Chrome CDP 연결 성공
- Codex/Claude usage page extraction 성공
- service-specific parser 구현
- diagnostic artifacts 생성
- parser 실패 시 명확한 로그 생성
- 한 서비스 실패가 전체 monitor를 중단하지 않음

상태:

완료.

### Phase-a-03 — Usage normalization + event detection + Mongi notification engine

목표:

Codex/Claude의 서로 다른 percent 의미를 `remainingPercent` 기준으로 통일하고, usage 변화에 따라 알림 이벤트를 판단한다.

포함 내용:

- Codex/Claude percent semantic normalization
- `remainingShortWindowPercent`
- `remainingWeeklyPercent`
- recovered short event
- recovered weekly event
- usage active silent detection
- session stopped summary
- weekly idle reminder
- diagnostic digest
- quiet hours
- duplicate prevention
- Mongi random message templates
- scenario tests

완료 기준:

- Claude `0% used`가 remaining 100으로 해석됨
- Codex/Claude 모두 canonical remaining field 보유
- event detection은 remaining field만 사용
- `npm run test:scenarios` 통과
- `npm run monitor`가 실제 CDP extraction 결과로 state 업데이트
- Discord notification system이 작동
- usage_active는 알림을 보내지 않음

상태:

완료.

---

## Phase-b — Local automation + one-click CDP Chrome starter

목표:

수동 실행해야 하던 CDP Chrome과 monitor 실행을 Mac에서 쉽게 시작하고, monitor를 주기적으로 자동 실행되게 만든다.

Phase-b의 목표는 “완전 서버 자동화”가 아니다.  
목표는 사용자가 Mac을 켰을 때 버튼 하나로 Mongi 실행 환경을 열고, 이후 monitor가 주기적으로 돌아가게 하는 것이다.

### Phase-b-01 — One-click CDP Chrome starter

목표:

사용자가 긴 터미널 명령어를 매번 입력하지 않도록, CDP Chrome을 버튼처럼 실행할 수 있는 entrypoint를 만든다.

현재 수동 명령:

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.mongi-chrome-profile"

구현 후보:

1. `scripts/start-cdp-chrome.sh`
2. `Mongi Start.command`
3. macOS Automator app
4. macOS Shortcuts app

v1 추천:

- 먼저 `.command` 파일 또는 shell script로 구현
- 이후 필요하면 Automator/Shortcuts로 감싸기

포함 작업:

- CDP Chrome 실행 script 작성
- 이미 9222 포트가 열려 있으면 중복 실행하지 않음
- Chrome이 이미 실행 중인지 확인
- Codex/Claude usage page를 자동으로 열기
- 실행 방법 README 문서화

완료 기준:

- 사용자가 더블클릭 또는 짧은 npm script로 CDP Chrome을 열 수 있다.
- Chrome이 이미 열려 있으면 중복 실행을 피한다.
- `curl http://127.0.0.1:9222/json/version`으로 CDP 상태를 확인할 수 있다.

### Phase-b-02 — launchd monitor automation

목표:

Mac에서 monitor가 주기적으로 자동 실행되게 한다.

포함 작업:

- launchd plist example 작성
- install script 작성
- uninstall script 작성
- 10분마다 `npm run monitor` 실행
- stdout/stderr 로그 저장
- launchd 상태 확인 명령 문서화
- monitor 실행 실패 시 로그 확인 가능

완료 기준:

- launchd 등록 후 10분마다 monitor가 실행된다.
- Mac이 켜져 있고 로그인된 상태에서 자동 감시가 작동한다.
- Chrome CDP가 꺼져 있으면 diagnostic이 rate-limited로 처리된다.
- logs에서 실행 기록을 확인할 수 있다.

### Phase-b-03 — Local automation validation

목표:

one-click starter와 launchd monitor가 실제 생활 환경에서 쓸 수 있는지 검증한다.

포함 작업:

- CDP Chrome 켜짐/꺼짐 시나리오 검증
- monitor 반복 실행 검증
- Discord 스팸 여부 확인
- quiet hours 동작 확인
- Chrome 재시작 후 로그인 세션 유지 확인
- README troubleshooting 보강

완료 기준:

- 사용자가 Mac을 켜고 “몽이 시작”만 누르면 사용 준비가 된다.
- 이후 monitor는 자동으로 주기 실행된다.
- 실패해도 원인을 로그에서 확인할 수 있다.

---

## Phase-c — Reliability hardening + real-world usage validation

목표:

실제 1~2주 사용하면서 알림 정책, 메시지 빈도, state 안정성, CDP 연결 안정성을 검증하고 다듬는다.

Phase-c는 기능 추가보다 “진짜 내 생활에 도움이 되는가”를 확인하는 단계다.

### Phase-c-01 — Real usage observation

목표:

실제 개발 세션에서 Mongi가 적절한 타이밍에 알림을 보내는지 확인한다.

관찰 항목:

- recovered alert가 너무 늦거나 빠르지 않은가
- session stopped 기준 20분이 적절한가
- weekly idle reminder가 도움이 되는가, 짜증나는가
- quiet hours 설정이 맞는가
- Codex/Claude parser가 계속 안정적인가
- Discord 알림 문구가 행동으로 이어지는가

완료 기준:

- 최소 3~5일 이상 실제 사용
- 알림 과다/부족 여부 기록
- 수정할 정책 리스트 작성

### Phase-c-02 — Policy tuning + message refinement

목표:

실제 사용 결과를 바탕으로 알림 정책과 몽이 메시지를 조정한다.

포함 작업:

- idle threshold 조정 가능성
- weekly idle reminder interval 조정
- quiet hours 조정
- 메시지 템플릿 추가/삭제
- 너무 강한 메시지 완화
- 너무 약한 메시지 강화
- recommended action 다양화

완료 기준:

- 메시지가 스팸처럼 느껴지지 않는다.
- 알림이 실제 개발 행동으로 이어진다.
- 사용자는 Codex/Claude 구독 사용 상태를 더 잘 인식한다.

### Phase-c-03 — Subscription value review

목표:

Mongi가 실제로 월 6만원 구독료를 정당화하는지 판단할 수 있는 월간 리뷰 기준을 만든다.

포함 작업:

- 주간 최소 사용 기준 정의
- 주간 최소 산출물 기준 정의
- Codex/Claude 역할 분리
- 구독 유지/해지 판단 기준 작성
- README 또는 docs에 monthly review template 추가

완료 기준:

- 사용자는 매달 Codex/Claude를 계속 결제할지 판단할 근거를 가진다.
- “돈을 냈으니 써야지”를 넘어서 “산출물로 바뀌었는지”를 평가할 수 있다.

---

## Phase-d — Optional packaging / Chrome Extension research

목표:

Mongi Usage Coach를 더 편하게 쓰기 위한 포장 방식을 검토한다.

Phase-d는 v1 필수는 아니다.  
Phase-a~c가 실제로 유용하다고 판단된 뒤 진행한다.

### Phase-d-01 — macOS lightweight packaging

목표:

Mongi를 더 앱처럼 실행할 수 있게 포장한다.

후보:

- `.command` 파일 개선
- Automator app
- Shortcuts app
- 작은 menu bar app
- Electron/Tauri는 v1에서는 과함

완료 기준:

- 사용자가 터미널을 거의 열지 않고 Mongi를 시작할 수 있다.

### Phase-d-02 — Chrome Extension prototype research

목표:

CDP 방식 대신 Chrome Extension으로 usage page를 읽는 구조가 실용적인지 검토한다.

검토 항목:

- Manifest V3 구조
- background service worker lifecycle
- content script DOM access
- usage page 탭 필요 여부
- chrome.storage 기반 state 저장
- Discord Webhook 보관 방식
- 기존 parser/event/message 코드 재사용 가능성

완료 기준:

- Extension으로 전환할 가치가 있는지 판단한다.
- 실제 prototype을 만들지 여부를 결정한다.

### Phase-d-03 — Always-on environment review

목표:

Mac이 꺼져 있어도 작동하는 구조가 필요한지 재검토한다.

후보:

- 미니PC
- Raspberry Pi
- Oracle Cloud Free Tier
- VPS
- GitHub Actions

판단 기준:

- 추가 비용
- Cloudflare/로그인 안정성
- Chrome 세션 유지 가능성
- 실제 필요성

완료 기준:

- 상시 운영이 진짜 필요한지 판단한다.
- 필요하다면 가장 현실적인 운영 환경을 선택한다.

---

## 14. Phase별 상세 spec 작성 원칙

각 phase spec은 다음 구조를 가진다.

- Phase 이름
- 목적
- 배경
- 포함 범위
- 제외 범위
- 작업 파일
- 구현 요구사항
- Agent 판단권
- 검증 명령
- 성공 기준
- 실패 시 대안
- 완료 보고 형식

각 phase spec은 Agent가 독립적으로 읽고 작업할 수 있어야 한다.

---

## 15. AGENTS.md 원칙

AGENTS.md는 Agent가 항상 따라야 하는 프로젝트 운영 규칙이다.

포함할 내용:

- MVP_SPEC.md를 먼저 읽을 것
- DESIGN.md를 읽고 몽이 캐릭터 톤을 유지할 것
- 현재 phase spec을 읽을 것
- .env, browser-profile, logs, state.json을 커밋하지 말 것
- 실행 가능한 검증을 반드시 수행할 것
- 실패하면 대안을 시도할 것
- 완료 보고에 변경 파일과 실행 결과를 포함할 것
- 사용자의 목적은 “개인 생산성/구독료 최적화”임을 기억할 것

---

## 16. DESIGN.md 원칙

DESIGN.md는 몽이 캐릭터와 메시지 톤을 정의한다.

포함할 내용:

- 몽이의 역할
- 메시지 톤
- 권장 표현
- 금지 표현
- 상황별 메시지 예시
- 행동 유도 방식
- 과한 자기계발/비난/유치함 방지
- 사용자의 미래 목표와 연결된 메시지 철학

---

## 17. v1에서 하지 않을 것

다음은 명확히 제외한다.

- 웹 UI
- 로그인 시스템
- DB 서버
- SaaS화
- 유료 서버 전제
- iOS 앱
- Slack 연동
- Notion 연동
- AI API 기반 실시간 문구 생성
- 사용자의 컴퓨터 활동 추적
- 화면 녹화/키로깅/민감 활동 감지
- 복잡한 analytics dashboard

---

## 18. 최종 v1 Definition of Done

Mongi Usage Coach v1은 다음을 만족하면 완료다.

1. Mac local에서 npm script로 monitor를 실행할 수 있다.
2. Discord Webhook 테스트 메시지를 보낼 수 있다.
3. Playwright login session을 저장할 수 있다.
4. Codex usage page에 접근할 수 있다.
5. Claude usage page에 접근할 수 있다.
6. 가능한 경우 usage percent를 파싱한다.
7. 파싱 불가 시 명확한 diagnostic 로그를 남긴다.
8. state.json 기반 이벤트 판단이 작동한다.
9. recoveredShort, recoveredWeekly, sessionStopped, weeklyIdle 이벤트가 작동한다.
10. 랜덤 몽이 메시지가 발송된다.
11. quiet hours가 적용된다.
12. launchd로 10분마다 자동 실행된다.
13. 로그에서 실행 이력을 확인할 수 있다.
14. 서비스 하나가 실패해도 전체가 죽지 않는다.
15. README에 설치/로그인/실행/자동화/문제해결 방법이 있다.
16. Linux/VPS 이전 가능성이 문서화되어 있다.

## 19. 핵심 판단

이 프로젝트는 “앱을 하나 더 만드는 것”이 아니다.

이 프로젝트는 사용자가 이미 내고 있는 돈을 실제 성장과 개발 산출물로 전환시키기 위한 개인용 장치다.

따라서 v1의 성공은 코드 양이나 기능 수가 아니라 다음 질문으로 판단한다.

- Codex와 Claude를 더 자주, 더 의식적으로 쓰게 되었는가?
- 결제한 구독료가 실제 개발 산출물로 이어졌는가?
- 방치되는 주간 한도가 줄었는가?
- 사용자는 다시 개발을 시작하는 타이밍을 더 잘 잡게 되었는가?
- 몽이의 알림이 부담이 아니라 행동 트리거로 작동하는가?

이 질문에 yes가 나오면 v1은 성공이다.