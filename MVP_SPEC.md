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

## Phase-a — Local core monitoring foundation

목표:

Mac local에서 Codex/Claude usage page에 접근하고, 사용량 정보를 파싱하거나 파싱 실패를 명확히 진단하며, state 기반 이벤트 판단과 Discord 알림까지 완성한다.

Phase-a는 제품의 심장부다.  
이 단계가 성공하면 수동 실행 기준으로 이미 쓸 수 있어야 한다.

### Phase-a-01 — Project foundation + Discord notification + state engine

목표:

프로젝트 기본 구조, 환경변수, 로그, state 저장소, Discord Webhook 전송을 완성한다.

포함 작업:

- Node.js 프로젝트 초기화
- src 디렉토리 구조 생성
- .env.example 작성
- .gitignore 작성
- config 로더 작성
- logger 작성
- stateStore 작성
- Discord Webhook client 작성
- test-discord script 작성
- 기본 메시지 템플릿 구조 작성
- README 초안 작성

성공 기준:

- npm script로 Discord 테스트 메시지를 보낼 수 있다.
- state.json이 없으면 자동 생성된다.
- state read/write가 안정적으로 동작한다.
- .env 누락 시 명확한 에러를 출력한다.
- 민감 파일이 gitignore에 포함된다.

### Phase-a-02 — Playwright login/session + usage extraction strategy

목표:

Playwright로 Codex/Claude usage page에 접근하고, 실제 페이지에서 사용량 정보를 추출할 수 있는 최선의 방법을 찾는다.

포함 작업:

- scripts/login.js 작성
- browser-profile 기반 persistent context 구성
- Codex usage page 접근
- Claude usage page 접근
- debug-page-text script 작성
- innerText 추출 시도
- 퍼센트/라벨 기반 파싱 시도
- DOM selector 탐색
- accessibility snapshot 또는 대체 전략 검토
- 서비스별 parser 파일 생성
- parse confidence 모델 도입
- 파싱 실패 시 rawTextSample과 diagnostic 로그 남김

Agent 판단권:

- innerText로 충분히 잡히면 그 방식 우선
- innerText가 불충분하면 selector 기반으로 전환
- selector도 불안정하면 accessibility snapshot 시도
- headless 모드에서 실패하면 headless false로 비교
- 한 서비스가 실패해도 다른 서비스는 계속 진행
- 정확한 파싱이 불가능한 경우 degraded mode로 처리하고 명확히 보고

성공 기준:

- Codex 또는 Claude 중 최소 하나는 실제 percent 추출에 성공한다.
- 실패한 서비스는 왜 실패했는지 로그로 확인 가능하다.
- monitor에서 서비스별 parse result를 표준 객체로 받을 수 있다.
- parser는 서비스별로 분리되어 있다.

### Phase-a-03 — Event detection + Mongi random notification system

목표:

이전 사용량과 현재 사용량을 비교해 회복/사용 중/사용 종료/weekly idle 이벤트를 판단하고, 몽이 캐릭터 메시지를 Discord로 보낸다.

포함 작업:

- event detection 로직 작성
- recoveredShort 이벤트
- recoveredWeekly 이벤트
- sessionStopped 이벤트
- weeklyIdle 이벤트
- quiet hours 처리
- 중복 알림 방지
- messages.js 확장
- 상황별 랜덤 메시지 선택
- 변수 interpolation
- suggestedAction 생성
- parse failure digest 최소 구현
- monitor.js 통합

성공 기준:

- state.json을 조작하거나 mock parser를 사용해 모든 이벤트를 테스트할 수 있다.
- 100% 회복 이벤트가 중복 발송되지 않는다.
- 20분 무변화 조건에서 sessionStopped가 1회만 발송된다.
- weekly 100% 방치 알림이 설정된 간격으로만 발송된다.
- 메시지에 몽이 캐릭터성이 반영된다.
- 사용 중 상태에서는 알림이 발송되지 않는다.

---

## Phase-b — Local automation + reliability hardening

목표:

수동 실행으로만 동작하던 monitor를 Mac launchd로 자동 실행하고, 장시간 로컬 운영에서 깨지지 않도록 안정화한다.

Phase-b가 끝나면 사용자는 Mac을 켰을 때 별도 조작 없이 usage monitor를 사용할 수 있어야 한다.

### Phase-b-01 — Mac launchd automation

목표:

Mac에서 10분마다 monitor가 자동 실행되도록 launchd 설정을 제공한다.

포함 작업:

- launchd plist example 작성
- install-launchd.sh 작성
- uninstall-launchd.sh 작성
- logs directory 자동 생성
- which node 기반 경로 안내
- WorkingDirectory 설정
- stdout/stderr 로그 분리
- launchctl load/unload 문서화

성공 기준:

- launchd 등록 후 10분마다 monitor가 실행된다.
- 로그 파일에서 실행 기록을 확인할 수 있다.
- launchd 중지/재등록 방법이 README에 있다.

### Phase-b-02 — Reliability, diagnostics, and failure containment

목표:

Playwright 실패, 로그인 만료, 네트워크 오류, 파싱 실패가 발생해도 전체 시스템이 망가지지 않도록 한다.

포함 작업:

- service-level try/catch
- timeout 설정
- consecutiveParseFailures 카운트
- login expired 의심 상태 감지
- diagnostic summary 로그
- parse failure digest 알림 제한
- 전체 monitor run 실패 시 graceful exit
- state corruption 방지
- state backup 또는 atomic write 적용

Agent 판단권:

- 반복 실패가 있으면 로그를 분석해 원인을 분류
- 로그인 만료로 보이면 사용자에게 재로그인 필요 메시지 출력
- 페이지 구조 변경으로 보이면 parser diagnostic 출력
- 한 서비스가 실패해도 다른 서비스 알림은 유지

성공 기준:

- 하나의 서비스 파싱 실패가 전체 monitor를 중단시키지 않는다.
- state.json이 깨지면 복구 또는 재생성된다.
- 로그인 만료 의심 시 명확히 알 수 있다.
- 동일한 실패 알림이 과도하게 반복되지 않는다.

### Phase-b-03 — Local validation scenarios

목표:

실제 사용량 변화가 없더라도 mock/state manipulation으로 주요 시나리오를 검증할 수 있게 한다.

포함 작업:

- mock parser mode
- scenario runner script
- recovered scenario
- using scenario
- session stopped scenario
- weekly idle scenario
- quiet hours scenario
- parse failure scenario
- 테스트 결과 문서화

성공 기준:

- 실제 Codex/Claude 사용량을 기다리지 않아도 이벤트 로직을 검증할 수 있다.
- 각 시나리오에서 예상 알림/무알림이 맞는지 확인 가능하다.
- Agent가 작업 완료 시 어떤 검증을 했는지 명확히 보고할 수 있다.

---

## Phase-c — Always-on free operation path

목표:

Mac이 꺼져 있어도 가능한 무료 상시 운영 경로를 검토하고, 가장 현실적인 무료 운영 방식을 선택해 이전 가능성을 확보한다.

Phase-c는 필수 production path이지만, v1 초기 사용은 Mac local로 시작할 수 있다.

### Phase-c-01 — Free always-on environment evaluation

목표:

무료로 24시간 실행 가능한 후보를 비교하고, 이 프로젝트에 맞는지 검증한다.

후보:

- Oracle Cloud Free Tier VPS
- GitHub Actions scheduled workflow
- Render/Fly/Railway free tier 가능성
- 기타 무료 VM

평가 기준:

- 무료 여부
- Playwright 실행 가능 여부
- persistent browser profile 유지 가능 여부
- 로그인 세션 유지 가능 여부
- cron 실행 가능 여부
- 운영 복잡도
- 계정 정지/휴면 리스크
- 보안 리스크

성공 기준:

- 최소 2개 후보의 실제 가능성을 검토한다.
- 최종 추천 운영 경로를 하나 선택한다.
- 왜 GitHub Actions 또는 특정 플랫폼이 부적합한지 근거를 남긴다.

### Phase-c-02 — VPS/Linux cron migration readiness

목표:

Mac local 프로젝트를 Linux 서버로 옮길 수 있게 준비한다.

포함 작업:

- Linux setup guide 작성
- Node.js 설치 가이드
- Playwright dependency 설치 가이드
- .env 설정 가이드
- browser-profile 이전 또는 서버 내 재로그인 전략
- cron 등록 예시
- logs 위치 정리
- headless/headful 차이 문서화

성공 기준:

- README만 보고 Linux 서버에서 실행 준비가 가능하다.
- cron으로 monitor를 실행할 수 있는 명령이 있다.
- 서버에서 로그인 세션을 만드는 방법이 문서화되어 있다.

### Phase-c-03 — Operational policy and cost review

목표:

이 도구가 실제로 구독료 절약/활용률 개선에 기여하는지 판단할 기준을 만든다.

포함 작업:

- 월 6만원 구독 유지 판단 기준 작성
- 주간 최소 산출물 기준 정의
- Codex/Claude 각각의 사용 목적 분리
- weekly usage 100% 방치 빈도 기록 방법
- 월말 리뷰 템플릿 작성
- “둘 중 하나 해지해야 하는 조건” 정의

성공 기준:

- 사용자는 이 도구를 통해 단순히 알림을 받는 것이 아니라, 구독 유지 여부를 판단할 수 있다.
- 월말에 Codex/Claude가 실제 산출물로 이어졌는지 점검할 수 있다.

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