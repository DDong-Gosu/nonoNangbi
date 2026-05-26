# phase-b-03_SPEC.md

## Phase-b-03 — Local automation validation and usability hardening

## 0. 목적

Phase-b-03의 목적은 Mongi Usage Coach의 로컬 자동화가 실제 생활에서 안정적으로 돌아가도록 검증하고 다듬는 것이다.

Phase-b-01에서 CDP Chrome starter를 만들었다.  
Phase-b-02에서 launchd monitor automation을 만들었다.

Phase-b-03에서는 다음을 검증하고 개선한다.

1. 10분 반복 실행 안정성
2. CDP Chrome 꺼짐 상황
3. cold start 흐름
4. `Mongi Start.command` 사용성
5. launchd 상태/로그 확인 편의성
6. diagnostic 알림 스팸 방지
7. 로그 관리
8. README troubleshooting 강화

이 Phase는 새 기능을 크게 추가하는 단계가 아니다.  
이미 작동하는 로컬 자동화를 실제로 매일 쓸 수 있게 만드는 단계다.

---

## 1. 현재 상태

현재 완료된 것:

- Codex/Claude usage extraction 성공
- CDP Chrome 연결 성공
- usage percent normalization 성공
- event detection 성공
- Discord Webhook 성공
- one-click CDP Chrome starter 생성
- launchd 설치 성공
- RunAtLoad 실행 성공
- 10분 간격 반복 실행 로그 확인

최근 확인된 로그:

- 02:08 monitor run
- 02:18 monitor run
- 02:28 monitor run
- 02:38 monitor run

즉 launchd StartInterval 600초 반복 실행은 실제로 작동한다.

---

## 2. 포함 범위

Phase-b-03에 포함되는 작업:

1. launchd 반복 실행 검증 결과 문서화
2. local health check script 작성
3. CDP Chrome 꺼짐 상황 검증/진단 개선
4. launchd logs 요약 script 작성
5. 상태 확인 명령 개선
6. log rotation 또는 log size warning 추가
7. `Mongi Start.command` 사용성 보강
8. README troubleshooting 강화
9. 최종 local operation checklist 작성
10. 기존 monitor/test/scenario 재검증

---

## 3. 제외 범위

Phase-b-03에서 하지 않을 것:

- Chrome Extension 개발
- macOS menu bar app 개발
- Electron/Tauri 앱 개발
- VPS/미니PC 상시 운영
- parser 대규모 변경
- event policy 대규모 변경
- Discord 메시지 대규모 재작성
- launchd가 Chrome까지 자동 시작하게 만들기
- AI API 기반 메시지 생성
- dashboard 추가

주의:

- Phase-b-03은 “검증과 하드닝” 단계다.
- 기능 욕심을 내지 않는다.

---

## 4. 핵심 목표

Phase-b-03 완료 후 사용자는 다음을 명확히 할 수 있어야 한다.

1. Mongi가 지금 정상 작동 중인지
2. launchd가 설치되어 있는지
3. monitor가 최근 언제 실행됐는지
4. CDP Chrome이 켜져 있는지
5. Codex/Claude parsing이 최근 성공했는지
6. Discord 알림이 왜 안 왔는지
7. quiet hours 때문에 suppress된 것인지
8. 문제 발생 시 어떤 명령을 실행해야 하는지

---

## 5. 파일 구조 요구사항

생성 또는 수정할 파일:

- `scripts/health-check.js`
- `scripts/summarize-launchd-logs.js`
- `scripts/verify-local-automation.sh`
- `package.json`
- `README.md`

선택:

- `docs/LOCAL_OPERATION_CHECKLIST.md`
- `docs/TROUBLESHOOTING.md`
- `scripts/reset-cdp-profile.sh`

`reset-cdp-profile.sh`는 선택이다. 만든다면 매우 조심스럽게 작성해야 한다. 기본 실행 시 바로 삭제하면 안 되고, confirmation이 필요하다.

---

## 6. package.json scripts 요구사항

추가 scripts:

- `health`
- `logs:summary`
- `verify:local`

예상 매핑:

- `health` -> `node scripts/health-check.js`
- `logs:summary` -> `node scripts/summarize-launchd-logs.js`
- `verify:local` -> `bash scripts/verify-local-automation.sh`

기존 scripts 유지:

- `start:chrome`
- `check:cdp`
- `launchd:install`
- `launchd:uninstall`
- `launchd:status`
- `launchd:logs`
- `monitor`
- `monitor:run`
- `debug:page-text`
- `test:state`
- `test:discord`
- `test:scenarios`

---

## 7. health-check.js 요구사항

`scripts/health-check.js`는 Mongi의 현재 상태를 한 번에 요약한다.

확인 항목:

1. `.env` 존재 여부
2. Discord Webhook 설정 여부  
   - 값 전체 출력 금지
3. CDP URL 설정 여부
4. CDP reachable 여부
5. launchd plist 존재 여부
6. launchd loaded 여부
7. `data/state.json` 존재 여부
8. Codex/Claude 최근 checkedAt
9. Codex/Claude remaining percent
10. parse failure count
11. quiet hours 현재 적용 여부
12. 최근 launchd log timestamp
13. 최근 monitor exit code 추정 가능 여부

출력 예시:

Mongi Health Check

Config:
- .env: found
- Discord webhook: configured
- Browser mode: cdp
- CDP: reachable

Launchd:
- plist: installed
- loaded: yes
- last wrapper run: 2026-05-26 02:38:23 +0900

Usage:
- Codex: remaining short 54, weekly 54, failures 0, checked 2026-...
- Claude: remaining short 100, weekly 100, failures 0, checked 2026-...

Notifications:
- quiet hours active: yes
- recent notifications sent: 0

주의:

- Webhook URL 출력 금지
- full state dump 출력 금지
- full logs 출력 금지

---

## 8. summarize-launchd-logs.js 요구사항

`scripts/summarize-launchd-logs.js`는 launchd logs를 짧게 요약한다.

입력 파일:

- `logs/launchd-out.log`
- `logs/launchd-error.log`

출력 항목:

1. 최근 wrapper start 시각
2. 최근 wrapper finish 시각
3. 최근 exit code
4. 최근 monitor run completed 여부
5. 최근 CDP reachable 여부
6. 최근 parse success/failure 요약
7. 최근 events
8. 최근 notificationsSent
9. error log 최근 주요 라인

목표:

- 사용자가 긴 로그를 직접 읽지 않아도 현재 상태를 파악할 수 있어야 한다.

주의:

- JSON 로그 parsing이 실패해도 script가 죽지 말고 best-effort summary를 출력한다.
- full logs를 출력하지 않는다.

---

## 9. verify-local-automation.sh 요구사항

`scripts/verify-local-automation.sh`는 로컬 자동화 검증 루틴을 실행한다.

필수 체크:

1. `npm run check:cdp`
2. `npm run test:state`
3. `npm run test:scenarios`
4. `npm run monitor`
5. `npm run health`
6. `npm run logs:summary`

선택 체크:

- `npm run test:discord`
- `.env`에 Webhook이 있으면 실행
- 없으면 skip

주의:

- Discord 스팸 방지를 위해 monitor를 여러 번 반복 실행하지 않는다.
- 실제 이벤트 notification이 발생할 수 있음을 안내한다.
- quiet hours 상태를 출력한다.

---

## 10. CDP 꺼짐 상황 하드닝

Phase-b-03에서 CDP Chrome이 꺼졌을 때 다음이 명확해야 한다.

1. `npm run health`에서 CDP unreachable 표시
2. `npm run logs:summary`에서 최근 실패 요약
3. README에서 해결 방법 안내
4. diagnostic Discord가 rate-limited인지 확인

필요하면 기존 monitor/browserContext의 에러 메시지를 소폭 개선한다.

예상 메시지:

CDP Chrome is not reachable at http://127.0.0.1:9222.
Run `npm run start:chrome` or double-click `Mongi Start.command`.

주의:

- CDP unreachable은 launchd 설치 실패가 아니다.
- CDP unreachable은 “Chrome starter를 안 켠 상태”일 수 있다.

---

## 11. log 관리 요구사항

현재 launchd logs는 계속 쌓일 수 있다.

Phase-b-03에서는 최소한 다음 중 하나를 구현한다.

Option A — log size warning:

- health check에서 log 파일 크기가 일정 이상이면 warning 출력
- 예: 5MB 이상

Option B — simple log truncate script:

- `scripts/truncate-logs.sh`
- `npm run logs:clear`
- 실행 시 confirmation 또는 명확한 안내 필요

권장:

- v1에서는 log size warning만 우선
- 자동 삭제는 하지 않는다

---

## 12. Mongi Start.command 사용성 보강

필요하면 `Mongi Start.command` 출력 메시지를 개선한다.

포함할 안내:

- CDP Chrome이 열렸는지
- Codex/Claude usage page가 보이는지
- 로그인/Turnstile 필요할 수 있음
- launchd monitor는 별도로 자동 실행 중일 수 있음
- 상태 확인: `npm run health`

단, 너무 길게 만들지 않는다.

---

## 13. README 업데이트 요구사항

README에 다음 섹션을 강화한다.

### Daily workflow

예시:

1. Mac 켜기
2. `Mongi Start.command` 더블클릭
3. Codex/Claude usage page 로그인 확인
4. `npm run health`로 상태 확인
5. launchd가 10분마다 monitor 실행

### Health check

- `npm run health`
- 결과 해석

### Log summary

- `npm run logs:summary`

### Local verification

- `npm run verify:local`

### Troubleshooting

필수 항목:

- Discord는 되는데 알림이 안 옴
- quiet hours라 suppress됨
- CDP unreachable
- launchd loaded가 no
- monitor는 성공하는데 usage가 안 바뀜
- Codex/Claude 로그인 풀림
- Turnstile이 다시 뜸
- logs가 너무 큼
- state가 꼬인 것 같음

---

## 14. 검증 명령

Agent는 작업 후 최소 아래 명령을 실행한다.

node -c scripts/health-check.js
node -c scripts/summarize-launchd-logs.js
bash -n scripts/verify-local-automation.sh

npm run health
npm run logs:summary
npm run verify:local

기존 검증:

npm run test:state
npm run test:scenarios
npm run check:cdp
npm run monitor

가능하면:

npm run test:discord

---

## 15. 성공 기준

Phase-b-03 완료 조건:

1. `npm run health`가 현재 Mongi 상태를 요약한다.
2. `npm run logs:summary`가 launchd 로그를 요약한다.
3. `npm run verify:local`이 핵심 검증 루틴을 실행한다.
4. CDP unreachable 상태가 명확히 진단된다.
5. quiet hours 상태가 health check에서 보인다.
6. 최근 Codex/Claude remaining percent가 health check에 보인다.
7. launchd loaded 여부가 health check에 보인다.
8. README에 daily workflow와 troubleshooting이 있다.
9. 기존 monitor/scenario/test 명령이 깨지지 않는다.

---

## 16. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-b-03 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. Health check result
- ...

6. Log summary result
- ...

7. Local verification result
- ...

8. Remaining operational risks
- ...

9. Next recommended phase
- Phase-c — Real-world usage validation and policy tuning

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full logs를 붙이지 말 것.
- full state dump를 붙이지 말 것.

---

## 17. 핵심 판단

Phase-b-03의 목적은 “더 많은 기능”이 아니다.

목적은 사용자가 매일 다음 질문에 바로 답할 수 있게 만드는 것이다.

- 지금 Mongi 살아있나?
- Chrome CDP 켜져 있나?
- launchd 돌고 있나?
- 마지막 monitor는 성공했나?
- 왜 Discord 알림이 안 왔나?
- 뭘 누르면 다시 정상화되나?

이 질문에 빠르게 답할 수 있으면 Phase-b-03은 성공이다.