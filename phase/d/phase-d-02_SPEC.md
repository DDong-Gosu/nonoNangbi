# phase-d-02_SPEC.md

## Phase-d-02 — Chrome Extension feasibility research

## 0. 목적

Phase-d-02의 목적은 현재 CDP Chrome 기반 구조를 장기적으로 Chrome Extension 기반 구조로 바꿀 가치가 있는지 검토하는 것이다.

현재 Mongi는 CDP Chrome을 사용한다.

현재 구조:

- 사용자가 CDP Chrome을 시작한다.
- Codex/Claude usage pages에 로그인한다.
- Playwright CDP가 browser에 연결한다.
- usage page DOM/text를 읽는다.
- Node monitor가 state/event/notification을 처리한다.
- launchd가 10분마다 monitor를 실행한다.

이 방식은 작동하지만 단점이 있다.

- CDP Chrome을 사용자가 켜야 한다.
- sleep/wake 후 CDP가 죽을 수 있다.
- usage page tab이 열려 있어야 한다.
- Chrome profile/session 상태에 의존한다.
- 사용자가 Chrome 창/탭 상태를 신경써야 한다.

Chrome Extension은 이 중 일부를 줄일 수 있다.

하지만 Extension은 새로운 복잡성이 있다.

- Manifest V3
- service worker lifecycle
- content script 권한
- host permissions
- chrome.storage
- Discord webhook 보관
- background alarm reliability
- page/tab 필요 여부
- Chrome Web Store/보안 제한
- Node core 재사용 어려움

Phase-d-02는 prototype 구현이 아니라 feasibility research다.

---

## 1. 핵심 질문

Phase-d-02에서 답해야 할 질문:

1. Chrome Extension으로 Codex/Claude usage page를 안정적으로 읽을 수 있는가?
2. usage page tab이 반드시 열려 있어야 하는가?
3. content script가 필요한 DOM/text를 읽을 수 있는가?
4. service worker가 주기적으로 안정 실행될 수 있는가?
5. 기존 Node parser/event/message code를 재사용할 수 있는가?
6. Discord webhook을 extension에 저장하는 것이 안전한가?
7. CDP 방식보다 실제로 편해지는가?
8. 구현 비용 대비 이득이 있는가?
9. v1 이후 extension prototype을 만들 가치가 있는가?

---

## 2. 포함 범위

Phase-d-02에 포함되는 작업:

1. Chrome Extension architecture research 문서 작성
2. Manifest V3 구조 검토
3. permissions/host_permissions 설계
4. content script DOM access 가능성 검토
5. service worker lifecycle 검토
6. chrome.alarms 기반 scheduling 검토
7. chrome.storage 기반 state 설계
8. Discord notification 방식 검토
9. 기존 Node code 재사용 가능성 평가
10. CDP vs Extension 비교
11. extension prototype을 할지 말지 결정 기준 작성
12. README 또는 docs에 결과 링크 추가

---

## 3. 제외 범위

Phase-d-02에서 하지 않을 것:

- 실제 Chrome Extension 구현
- Chrome Web Store 배포
- Discord webhook extension UI 구현
- parser 재작성
- Node core 제거
- CDP 구조 제거
- production migration
- 자동 로그인/Cloudflare 우회
- captcha/Turnstile bypass
- 외부 서버 구축

이 Phase는 research / design decision only다.

---

## 4. 생성 파일

필수 생성:

- `docs/CHROME_EXTENSION_FEASIBILITY.md`

선택 생성:

- `docs/CHROME_EXTENSION_ARCHITECTURE.md`
- `docs/CDP_VS_EXTENSION.md`

README 업데이트:

- Phase-d-02 research 결과 위치
- 최종 판단 요약

---

## 5. 검토 항목

### 5.1 Manifest V3

검토:

- manifest version
- background service worker
- content scripts
- permissions
- host_permissions
- alarms
- storage
- tabs
- scripting
- notifications optional

질문:

- 어떤 permission이 필요한가?
- permissions가 과도하지 않은가?
- host permission을 Codex/Claude usage page로 제한할 수 있는가?

---

### 5.2 Content script

검토:

- Codex/Claude usage page에서 content script가 DOM/text를 읽을 수 있는가?
- SPA page transition에 대응 가능한가?
- page가 열려 있지 않으면 읽을 수 없는가?
- hidden tab에서도 DOM을 읽을 수 있는가?
- 페이지 구조 변경에 얼마나 취약한가?

---

### 5.3 Background service worker

검토:

- MV3 service worker는 항상 살아있지 않다.
- chrome.alarms로 주기 작업을 트리거할 수 있다.
- service worker가 content script에 message를 보내려면 tab이 필요하다.
- tab이 없으면 새 tab 생성이 필요한가?
- 새 tab 생성 시 사용자 방해가 생기는가?

---

### 5.4 State storage

검토:

- chrome.storage.local 사용 가능성
- 기존 `data/state.json` 구조와 매핑
- event history 저장 방식
- parse failures 저장 방식
- quiet hours state 저장 방식

---

### 5.5 Notification

검토 후보:

1. Discord Webhook을 extension에서 직접 호출
2. Native messaging으로 local Node app에 전달
3. extension은 usage만 읽고 Node가 notification 처리
4. Chrome notification API 사용

평가 기준:

- 보안
- 구현 난이도
- 사용자 설정 편의성
- 기존 Discord message reuse
- webhook secret 노출 위험

---

### 5.6 기존 code 재사용성

평가:

- parsers 재사용 가능성
- eventDetector 재사용 가능성
- messages 재사용 가능성
- notificationDispatcher 재사용 가능성
- policy config 재사용 가능성

가능성이 높은 것:

- parser 로직 일부
- event detection 로직 일부
- message templates 일부

어려운 것:

- Node fs 기반 stateStore
- launchd automation
- CDP browser connection
- Discord secret handling
- scripts 기반 status output

---

## 6. 비교 표 요구사항

`docs/CHROME_EXTENSION_FEASIBILITY.md`에는 CDP vs Extension 비교표를 포함한다.

비교 항목:

- setup difficulty
- login reliability
- sleep/wake behavior
- background reliability
- user interruption risk
- parser stability
- state storage
- notification security
- code reuse
- maintenance cost
- v1 suitability
- long-term suitability

---

## 7. 결정 기준

최종 판단은 다음 중 하나여야 한다.

### Option A — Stay on CDP for v1

조건:

- SwiftUI wrapper로 충분히 편해짐
- Extension 복잡도가 큼
- usage tab 필요 문제가 해결되지 않음
- MV3 lifecycle이 불확실함
- 기존 Node code가 안정적임

### Option B — Build small Extension prototype later

조건:

- content script로 usage reading이 가능해 보임
- permissions가 제한적임
- tab 필요성이 관리 가능함
- 기존 parser 일부 재사용 가능
- CDP sleep/wake 문제가 계속 불편함

### Option C — Move fully to Extension eventually

조건:

- Extension이 usage 읽기, state, notification까지 안정적으로 처리 가능
- CDP보다 확실히 편함
- 보안/권한 문제가 수용 가능함

Phase-d-02의 기본 기대 결론은 Option A 또는 B다.  
Option C는 보수적으로 판단한다.

---

## 8. 보안/정책 원칙

금지:

- Cloudflare/Turnstile 우회
- captcha bypass
- 비정상 자동 로그인
- 세션 쿠키 추출
- 민감 데이터 외부 전송
- webhook secret을 문서에 기록

Extension은 사용자가 직접 로그인한 페이지에서 사용자가 접근 가능한 정보를 읽는 범위로 제한한다.

---

## 9. README 업데이트

README에 추가:

### Chrome Extension feasibility

포함:

- research 문서 위치
- 현재 판단 요약
- v1은 CDP + SwiftUI wrapper 유지 여부
- extension prototype을 만들 조건
- 보안 원칙

---

## 10. 검증 요구사항

이 Phase는 research 문서 작업이다.

검증:

- `docs/CHROME_EXTENSION_FEASIBILITY.md` 존재
- 문서에 Manifest V3, content script, service worker, storage, notification, code reuse 검토 포함
- CDP vs Extension 비교표 포함
- 최종 판단 포함
- README 링크 포함

필요하면 공식 문서를 조사해 근거를 남긴다.

---

## 11. 성공 기준

Phase-d-02 완료 조건:

1. Chrome Extension feasibility 문서가 존재한다.
2. Manifest V3 구조가 설명되어 있다.
3. content script 가능성과 한계가 설명되어 있다.
4. service worker lifecycle 리스크가 설명되어 있다.
5. storage/notification/security 검토가 있다.
6. 기존 Node code 재사용 가능성이 평가되어 있다.
7. CDP vs Extension 비교표가 있다.
8. 최종 판단 Option A/B/C 중 하나가 제시되어 있다.
9. README에 결과가 연결되어 있다.
10. 실제 구현 여부와 다음 조건이 명확하다.

---

## 12. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-d-02 Report

1. Files created/changed
- ...

2. Research areas covered
- ...

3. Final recommendation
- Option A / B / C
- reason

4. CDP vs Extension summary
- ...

5. Security assessment
- ...

6. Code reuse assessment
- ...

7. Failed / Not verified
- ...

8. Next recommended phase
- Phase-d-03 — Always-on environment review
  or Phase-d-02b — Chrome Extension prototype spec

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- Cloudflare/Turnstile 우회 방법을 제안하지 말 것.

---

## 13. 핵심 판단

Chrome Extension은 CDP보다 무조건 좋은 선택이 아니다.

Extension은 사용자가 보기에는 더 앱답게 느껴질 수 있지만, 내부적으로는 MV3 lifecycle, permissions, content script, storage, secret handling 문제가 있다.

Phase-d-02의 목적은 구현이 아니라 판단이다.

결론은 솔직해야 한다.

“만들 수 있다”와 “v1에 만들 가치가 있다”는 다르다.