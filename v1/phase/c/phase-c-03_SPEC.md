# phase-c-03_SPEC.md

## Phase-c-03 — Subscription value review + monthly decision framework

## 0. 목적

Phase-c-03의 목적은 Mongi Usage Coach가 Codex/Claude 구독을 실제 개발 산출물로 전환하고 있는지 판단할 수 있는 리뷰 체계를 만드는 것이다.

지금까지 Mongi는 다음을 갖췄다.

- Codex/Claude usage extraction
- normalized remaining percent
- event detection
- Discord notification
- CDP Chrome starter
- launchd automation
- health/log/daily summary
- real-world validation docs
- policy config
- structured status JSON

이제 필요한 질문은 이것이다.

“이번 달 Codex/Claude 구독료는 실제 산출물로 회수되고 있는가?”

Phase-c-03은 사용자가 감정이나 막연한 죄책감이 아니라, 구체적인 기준으로 구독 유지/해지/역할 조정을 판단할 수 있게 한다.

---

## 1. 핵심 판단

AI 구독의 가치는 단순 usage percent로 판단하지 않는다.

나쁜 기준:

- “많이 썼으니까 괜찮다”
- “돈 냈으니까 써야 한다”
- “이번 주에 알림이 왔으니까 괜찮다”

좋은 기준:

- 실제 코드가 남았는가
- 문서/spec/README가 남았는가
- 배포/디버깅이 진행됐는가
- 학습 노트가 남았는가
- 문제 해결 시간이 줄었는가
- 다음 작업이 더 명확해졌는가
- 구독료 이상의 행동 변화가 있었는가

Mongi의 목적은 사용량 감시가 아니라 산출물 전환이다.

---

## 2. 포함 범위

Phase-c-03에 포함되는 작업:

1. `docs/SUBSCRIPTION_VALUE_REVIEW.md` 작성
2. `docs/MONTHLY_REVIEW_TEMPLATE.md` 작성
3. `docs/WEEKLY_OUTPUT_TEMPLATE.md` 작성
4. `scripts/value-review.js` 작성
5. `npm run value:review` 추가
6. `npm run value:review -- --json` 지원
7. Codex/Claude 역할 분리 기준 작성
8. 구독 유지/해지/조정 판단 기준 작성
9. README에 subscription value review 섹션 추가
10. 향후 SwiftUI 앱에서 읽을 수 있는 JSON output 제공

---

## 3. 제외 범위

Phase-c-03에서 하지 않을 것:

- 결제 API 연동
- 실제 구독 해지 자동화
- 은행/카드 데이터 연동
- 웹 대시보드
- SwiftUI 앱 개발
- Chrome Extension 개발
- AI-generated financial advice
- 복잡한 ROI 계산
- DB 추가
- 외부 서버 추가

이 Phase는 개인 의사결정 프레임워크와 로컬 요약 도구만 만든다.

---

## 4. 리뷰 단위

Phase-c-03은 세 가지 단위의 리뷰를 정의한다.

### 4.1 Daily

이미 Phase-c-01에서 daily summary와 usage review template이 있다.

Daily의 목적:

- 오늘 사용했는지 확인
- 오늘 산출물이 있었는지 확인
- 알림이 행동으로 이어졌는지 확인

### 4.2 Weekly

Weekly의 목적:

- 한 주 동안 실제 개발/학습 산출물이 있었는지 확인
- Codex/Claude 각각의 역할이 명확했는지 확인
- 구독이 루틴을 밀어줬는지 확인

### 4.3 Monthly

Monthly의 목적:

- 구독 유지/해지/다운그레이드/역할 재조정을 판단
- 비용 대비 산출물과 행동 변화를 평가
- 다음 달 사용 기준을 세움

---

## 5. 산출물 기준

Mongi는 단순 사용량이 아니라 산출물을 본다.

인정되는 산출물 예시:

- 기능 구현
- 버그 수정
- 배포 성공
- README/docs 정리
- spec/prompt 작성
- 테스트 추가
- 리팩터링
- 학습 노트
- 의사결정 문서
- 면접/지원서/포트폴리오 개선
- 실제 프로젝트 phase 완료

낮은 가치 사용 예시:

- 의미 없는 질문 반복
- 결과물을 저장하지 않은 대화
- 개발 흐름과 무관한 산만한 사용
- 단순 호기심 검색
- 결론 없는 아이디어 탐색만 반복

---

## 6. Codex/Claude 역할 분리 기준

문서에 다음 기준을 포함한다.

### Codex 권장 역할

- 코드 수정
- 테스트 작성
- 디버깅
- 리팩터링
- repo 기반 작업
- 구현 phase 실행
- 반복 작업 자동화

### Claude 권장 역할

- 긴 문서 정리
- 기획/spec 작성
- reasoning-heavy 설계
- 글 구조화
- 회고/리뷰
- 큰 맥락 검토
- 코드 구현 전 계획 수립

### 역할 충돌 판단

다음 경우 역할 분리 실패로 기록한다.

- Codex로 해야 할 repo 작업을 Claude에서 길게 말만 하고 끝냄
- Claude로 정리해야 할 기획을 Codex에게 애매하게 시킴
- 둘 다 켜놓고 실제 산출물이 없음
- 같은 문제를 두 도구에 반복 질문했지만 결정이 없음

---

## 7. 최소 유지 기준

문서에 기본 기준을 둔다.

예시 기본값:

### Weekly minimum

- 최소 3일 이상 실제 사용
- 최소 2개 이상의 명확한 산출물
- 최소 1개 이상의 프로젝트 phase 전진
- daily summary 3회 이상 확인
- usage가 산출물로 연결된 사례 2개 이상 기록

### Monthly minimum

- 최소 8개 이상의 명확한 산출물
- 최소 2개 이상의 의미 있는 project milestone
- Codex/Claude 역할 구분이 명확해짐
- 적어도 한 번 이상 구독 유지/해지 판단 기록
- 사용하지 않은 주가 2주 이상이면 해지/다운그레이드 검토

주의:

기준은 강제 규칙이 아니라 판단 기준이다.

---

## 8. decision framework

월말 판단은 네 가지 중 하나다.

### Keep

조건 예시:

- 산출물이 충분하다
- 개발 루틴에 도움이 된다
- 알림이 행동으로 이어진다
- 구독료가 낭비처럼 느껴지지 않는다

### Keep but adjust

조건 예시:

- 사용은 하지만 역할이 흐릿하다
- 알림이 너무 많거나 적다
- 한 도구는 잘 쓰고 다른 도구는 애매하다
- 사용 시간은 있는데 산출물이 부족하다

### Pause / downgrade

조건 예시:

- 한 달 동안 산출물이 적다
- 특정 도구를 거의 쓰지 않는다
- 다른 무료/저가 도구로 충분하다
- 구독이 압박만 주고 행동으로 이어지지 않는다

### Cancel

조건 예시:

- 2주 이상 실사용이 거의 없다
- 산출물이 거의 없다
- 알림을 무시한다
- 사용 루틴이 유지되지 않는다
- 비용 대비 명확한 이득이 없다

---

## 9. value-review.js 요구사항

생성 파일:

- `scripts/value-review.js`

package script:

- `value:review` -> `node scripts/value-review.js`

지원:

- text mode: `npm run value:review`
- JSON mode: `npm run value:review -- --json`

입력:

- `data/state.json`
- `logs/launchd-out.log`
- `logs/launchd-error.log`
- 가능하면 daily summary parsing logic 재사용
- policy config
- review docs는 읽을 필요 없음

출력 text mode 항목:

1. Header
2. Current usage snapshot
3. Recent monitor reliability
4. Event/notification summary
5. Subscription value checklist
6. Codex role prompt
7. Claude role prompt
8. Weekly review questions
9. Monthly decision questions
10. Suggested decision placeholder

예시:

Mongi Value Review

Usage snapshot:
- Codex remaining: short 83, weekly 83
- Claude remaining: short 100, weekly 100

Reliability:
- monitor runs today: 70
- success: 13
- failed: 57

Output checklist:
- Did you ship code this week?
- Did you create docs/specs?
- Did Codex solve repo work?
- Did Claude clarify planning?
- Did any alert produce action?

Decision:
- Not enough data yet. Complete 3–5 days of usage records.

JSON mode 항목:

{
  "generatedAt": "...",
  "usage": {},
  "reliability": {},
  "events": {},
  "notifications": {},
  "checklist": [],
  "weeklyQuestions": [],
  "monthlyQuestions": [],
  "decisionOptions": ["keep", "keep_but_adjust", "pause_or_downgrade", "cancel"],
  "suggestedDecision": {
    "status": "not_enough_data",
    "reason": "Complete 3–5 days of usage records before deciding."
  }
}

주의:

- 자동으로 구독 해지 판단을 단정하지 않는다.
- 사용 데이터가 부족하면 `not_enough_data`라고 말한다.
- full logs/state/secrets 출력 금지.

---

## 10. docs/SUBSCRIPTION_VALUE_REVIEW.md 요구사항

포함:

1. 목적
2. 사용량과 산출물의 차이
3. Codex/Claude 역할 분리
4. daily/weekly/monthly review 흐름
5. weekly minimum 기준
6. monthly minimum 기준
7. Keep / Keep but adjust / Pause or downgrade / Cancel 판단 기준
8. 예시 리뷰
9. Phase-d SwiftUI 앱에서 이 정보를 어떻게 활용할지

---

## 11. docs/WEEKLY_OUTPUT_TEMPLATE.md 요구사항

포함 필드:

- Week of
- Codex를 사용한 작업
- Claude를 사용한 작업
- 실제 산출물
- 완료한 phase
- 해결한 문제
- 시간 절약 사례
- 알림이 행동으로 이어진 사례
- 낭비된 사용
- 다음 주 조정점

---

## 12. docs/MONTHLY_REVIEW_TEMPLATE.md 요구사항

포함 필드:

- Month
- Paid tools reviewed
- Total meaningful output
- Project milestones
- Codex value
- Claude value
- Wasted usage patterns
- Subscription decision
- Keep / adjust / pause / cancel reason
- Next month rule

---

## 13. README 업데이트 요구사항

README에 추가:

### Subscription value review

포함:

- `npm run value:review`
- `npm run value:review -- --json`
- weekly/monthly review docs 위치
- Codex/Claude 역할 분리 기준
- 구독 유지/해지 판단 방식
- 이 기능은 금융 조언이 아니라 개인 생산성 리뷰라는 점

---

## 14. 검증 명령

Agent는 작업 후 아래 명령을 실행한다.

Syntax:

node -c scripts/value-review.js

Command validation:

npm run value:review
npm run value:review -- --json
npm run status:json
npm run policy:check
npm run daily:summary
npm run daily:summary -- --json
npm run health
npm run test:state
npm run test:scenarios

JSON validation:

- `npm run value:review -- --json` output이 valid JSON인지 확인
- full logs/state/secrets가 포함되지 않는지 확인

---

## 15. 성공 기준

Phase-c-03 완료 조건:

1. `docs/SUBSCRIPTION_VALUE_REVIEW.md`가 존재한다.
2. `docs/WEEKLY_OUTPUT_TEMPLATE.md`가 존재한다.
3. `docs/MONTHLY_REVIEW_TEMPLATE.md`가 존재한다.
4. `npm run value:review`가 동작한다.
5. `npm run value:review -- --json`이 valid JSON을 출력한다.
6. Codex/Claude 역할 분리 기준이 문서화되어 있다.
7. weekly/monthly 최소 기준이 문서화되어 있다.
8. Keep / adjust / pause / cancel 판단 기준이 있다.
9. README에 사용법이 있다.
10. 기존 status/policy/daily/test 명령이 깨지지 않는다.

---

## 16. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-c-03 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Value review result
- text mode works yes/no
- JSON mode valid yes/no
- suggestedDecision example

6. Docs summary
- subscription value review
- weekly output template
- monthly review template

7. Security checks
- webhook exposed no
- env dump exposed no
- full logs exposed no
- full state exposed no

8. Remaining risks
- ...

9. Next recommended phase
- Phase-d-01 — SwiftUI macOS app prototype

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full logs를 붙이지 말 것.
- full state dump를 붙이지 말 것.

---

## 17. 핵심 판단

Phase-c-03은 Mongi의 목적을 분명히 하는 단계다.

Mongi는 “구독 사용량 감시기”가 아니다.  
Mongi는 “돈을 산출물로 바꾸는 실행 코치”다.

이 Phase가 끝나면 사용자는 매주/매달 다음 질문에 답할 수 있어야 한다.

- Codex가 실제 코드 작업에 도움이 됐는가?
- Claude가 실제 설계/문서/판단에 도움이 됐는가?
- 이번 주 산출물은 무엇인가?
- 이번 달 구독료는 유지할 가치가 있는가?
- 다음 달에는 무엇을 다르게 쓸 것인가?