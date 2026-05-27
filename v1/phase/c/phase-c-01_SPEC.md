# phase-c-01_SPEC.md

## Phase-c-01 — Real-world usage validation + daily summary

## 0. 목적

Phase-c-01의 목적은 Mongi Usage Coach가 기술적으로 작동하는 것을 넘어서, 실제 생활에서 사용자의 개발 행동과 구독 활용률을 개선하는지 검증하는 것이다.

Phase-a와 Phase-b에서 구현된 것:

- Codex/Claude usage extraction
- usage normalization
- event detection
- Discord notification
- CDP Chrome starter
- launchd automation
- health/log/verify tools
- non-disruptive monitoring
- Automator launcher guide

이제 확인해야 할 질문은 이것이다.

“Mongi가 실제로 내가 Codex/Claude를 더 의식적으로 쓰게 만들고, 결제한 구독료를 개발 산출물로 바꾸게 돕는가?”

Phase-c-01은 3~5일 실사용 검증을 위한 문서, 기록 체계, daily summary 도구를 만든다.

---

## 1. 현재 상태

Mongi는 로컬 MVP로 실제 사용 가능한 상태다.

현재 운영 흐름:

1. 사용자가 Mac을 연다.
2. `Mongi Start.app`, `Mongi Start.command`, 또는 `npm run start:chrome`으로 CDP Chrome을 연다.
3. launchd가 10분마다 monitor를 실행한다.
4. monitor는 usage page를 조용히 읽는다.
5. 이벤트가 발생하면 Discord로 몽이 알림을 보낸다.
6. health/log summary로 상태를 확인할 수 있다.

남은 핵심 검증:

- 알림이 실제 개발 행동으로 이어지는가
- 알림 빈도가 적절한가
- weekly idle 알림이 도움이 되는가
- session stopped 기준 20분이 적절한가
- quiet hours가 적절한가
- parser/CDP가 며칠 동안 안정적인가
- Mongi Start 루틴이 귀찮지 않은가

---

## 2. 포함 범위

Phase-c-01에 포함되는 작업:

1. `docs/REAL_WORLD_VALIDATION.md` 작성
2. `docs/USAGE_REVIEW_TEMPLATE.md` 작성
3. `scripts/daily-summary.js` 작성
4. `npm run daily:summary` 추가
5. README에 Phase-c 실사용 검증 섹션 추가
6. daily summary가 state/logs를 읽어 하루 요약 출력
7. validation checklist 작성
8. 3~5일 실사용 관찰 기준 정의

---

## 3. 제외 범위

Phase-c-01에서 하지 않을 것:

- event policy 조정
- message template 대규모 수정
- parser 대규모 수정
- launchd 구조 변경
- Chrome Extension
- SwiftUI app
- menu bar app
- DB/dashboard 추가
- AI API 기반 분석
- 자동 월간 리포트 생성

Phase-c-01은 관찰 체계와 요약 도구를 만드는 단계다.  
정책 조정은 Phase-c-02에서 한다.

---

## 4. daily-summary 목적

`npm run daily:summary`는 사용자가 하루를 마무리할 때 Mongi 운영 상태를 빠르게 확인하는 도구다.

목표:

- 오늘 monitor가 정상적으로 돌았는지 확인
- Codex/Claude usage가 어떻게 변했는지 확인
- 어떤 이벤트가 감지됐는지 확인
- Discord 알림이 몇 번 갔는지 확인
- 실패/파싱 문제/quiet hours suppress를 확인
- 내일 조정할 점을 기록할 근거를 제공

이 도구는 완벽한 analytics가 아니다.  
launchd logs와 state를 best-effort로 요약하면 된다.

---

## 5. daily-summary.js 요구사항

생성 파일:

- `scripts/daily-summary.js`

입력:

- `data/state.json`
- `logs/launchd-out.log`
- `logs/launchd-error.log`

출력 항목:

1. 날짜
2. launchd monitor run count
3. successful monitor run count
4. failed monitor run count
5. latest monitor run time
6. Codex latest remaining short/weekly
7. Claude latest remaining short/weekly
8. Codex parse failures
9. Claude parse failures
10. detected events summary
11. notificationsSent total
12. quiet hours suppression hints
13. recent errors summary
14. suggested review questions

예상 출력 예시:

Mongi Daily Summary — 2026-05-26

Monitor:
- Runs detected: 24
- Successful runs: 22
- Failed runs: 2
- Latest run: 23:48

Usage:
- Codex remaining: short 43, weekly 43
- Claude remaining: short 100, weekly 100

Events:
- usage_active: 4
- session_stopped: 2
- weekly_idle: 1

Notifications:
- sent: 1
- suppressed likely due quiet hours: yes/no

Review:
- Did any alert make you start a dev session?
- Did any alert feel annoying?
- Did you convert usage into an actual artifact?

주의:

- full logs를 출력하지 않는다.
- Discord Webhook URL 출력 금지.
- full state dump 출력 금지.
- log parsing은 best-effort로 충분하다.

---

## 6. docs/REAL_WORLD_VALIDATION.md 요구사항

실사용 검증 문서다.

포함 내용:

1. 검증 목적
2. 검증 기간: 3~5일
3. 매일 시작 루틴
4. 매일 종료 루틴
5. 관찰 항목
6. 좋은 신호
7. 나쁜 신호
8. 기록 양식
9. Phase-c-02로 넘길 조정 후보

매일 시작 루틴:

- Mac 열기
- Mongi Start.app 또는 command 실행
- Codex/Claude usage page 확인
- `npm run health` optional
- 개발 시작

매일 종료 루틴:

- `npm run daily:summary`
- 실제 개발 산출물 기록
- 알림이 도움이 됐는지 평가
- 불편했던 점 기록

관찰 항목:

- Mongi Start를 실제로 누르게 되는가
- launchd가 정상 작동하는가
- CDP unreachable이 자주 발생하는가
- usage page login이 자주 풀리는가
- 알림이 행동으로 이어지는가
- 알림이 거슬리는가
- weekly idle이 압박으로 도움이 되는가, 짜증나는가
- quiet hours 설정이 맞는가

---

## 7. docs/USAGE_REVIEW_TEMPLATE.md 요구사항

구독 활용률 리뷰 템플릿이다.

포함 내용:

1. 오늘 날짜
2. 오늘 Mongi 시작 여부
3. Codex 사용 여부
4. Claude 사용 여부
5. 사용한 목적
6. 실제 산출물
7. 알림이 행동으로 이어졌는지
8. 알림이 불필요했는지
9. 내일 조정할 점
10. 이번 주 구독료가 산출물로 전환되고 있는지 판단

산출물 예시:

- bug fix
- phase spec 작성
- README 정리
- 배포 문제 해결
- parser 개선
- feature 구현
- 학습 노트 작성

중요:

단순히 “AI를 많이 썼다”가 아니라 “무엇이 남았는가”를 기록한다.

---

## 8. README 업데이트 요구사항

README에 추가할 섹션:

### Real-world validation

포함:

- Phase-c-01의 목적
- 3~5일 사용 방법
- `npm run daily:summary`
- daily review template 위치
- 어떤 데이터를 보고 판단할지
- Phase-c-02에서 정책 조정할 예정이라는 점

### Daily end routine

예시:

1. `npm run daily:summary`
2. `docs/USAGE_REVIEW_TEMPLATE.md` 기준으로 기록
3. 오늘 알림이 도움이 됐는지 판단
4. 내일 조정 후보 적기

---

## 9. package.json 요구사항

추가 script:

- `daily:summary` -> `node scripts/daily-summary.js`

기존 scripts 유지:

- health
- logs:summary
- verify:local
- monitor
- test:state
- test:scenarios
- start:chrome
- check:cdp

---

## 10. Agent 판단권

Agent는 다음을 스스로 판단해도 된다.

- daily-summary log parsing 방식
- event count 추출 방식
- notification count 추출 방식
- docs 문서 구조
- review template 문장
- README에 넣을 세부 분량

제한:

- event policy를 바꾸지 않는다.
- 메시지 템플릿을 대규모 수정하지 않는다.
- parser를 수정하지 않는다.
- DB를 추가하지 않는다.
- dashboard를 만들지 않는다.

---

## 11. 검증 명령

Agent는 작업 후 최소 아래 명령을 실행한다.

node -c scripts/daily-summary.js

npm run daily:summary
npm run health
npm run logs:summary
npm run test:state
npm run test:scenarios

문서 확인:

- `docs/REAL_WORLD_VALIDATION.md` 존재
- `docs/USAGE_REVIEW_TEMPLATE.md` 존재
- README에 Phase-c 내용 반영

---

## 12. 성공 기준

Phase-c-01 완료 조건:

1. `npm run daily:summary`가 동작한다.
2. daily summary가 launchd logs와 state를 요약한다.
3. full logs/state/secrets를 출력하지 않는다.
4. 실사용 검증 문서가 있다.
5. 구독 활용률 리뷰 템플릿이 있다.
6. README에 3~5일 실사용 루틴이 있다.
7. 기존 health/logs/test 명령이 깨지지 않는다.

---

## 13. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-c-01 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Daily summary result
- ...

6. Validation docs summary
- ...

7. Review template summary
- ...

8. Next recommended action
- Use Mongi for 3~5 days, then proceed to Phase-c-02 — Policy tuning + message refinement

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- full logs를 붙이지 말 것.
- full state dump를 붙이지 말 것.

---

## 14. 핵심 판단

Phase-c-01은 코드를 많이 짜는 단계가 아니다.

이 단계의 핵심은 Mongi가 실제로 사용자의 행동을 바꾸는지 측정할 수 있게 만드는 것이다.

기술적으로 작동하는 도구와 실제로 도움이 되는 도구는 다르다.

Phase-c-01은 이 차이를 검증하기 위한 단계다.