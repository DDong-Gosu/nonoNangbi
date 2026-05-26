# phase-b-02_SPEC.md

## Phase-b-02 — launchd monitor automation

## 0. 목적

Phase-b-02의 목적은 Mongi Usage Coach의 monitor를 macOS에서 주기적으로 자동 실행되게 만드는 것이다.

Phase-b-01에서는 사용자가 CDP Chrome을 쉽게 시작할 수 있도록 `npm run start:chrome`과 `Mongi Start.command`를 만들었다.

Phase-b-02에서는 사용자가 매번 `npm run monitor`를 직접 실행하지 않아도 되도록, macOS launchd를 사용해 monitor를 주기 실행한다.

기본 목표:

- Mac이 켜져 있고 로그인된 상태에서
- CDP Chrome이 열려 있으면
- launchd가 10분마다 `npm run monitor` 실행
- 로그가 파일에 남음
- 설치/해제/상태 확인이 쉬움

이 Phase는 Chrome Extension, 앱 패키징, VPS 상시 운영을 포함하지 않는다.

---

## 1. 배경

현재 Mongi Usage Coach는 수동으로 다음을 실행해야 한다.

1. `npm run start:chrome`
2. Codex/Claude usage page 로그인 확인
3. `npm run monitor`

이 방식은 작동하지만 매번 monitor를 직접 돌려야 한다.

Mongi의 목적은 사용량 회복/방치/세션 종료를 자동으로 감지하는 것이므로, monitor는 주기 실행되어야 한다.

macOS에서는 사용자 레벨 자동 실행에 launchd가 적합하다.

---

## 2. 포함 범위

Phase-b-02에 포함되는 작업:

1. launchd plist template 작성
2. launchd install script 작성
3. launchd uninstall script 작성
4. launchd status/check script 작성
5. launchd logs 경로 정리
6. monitor 실행용 wrapper script 작성
7. README 업데이트
8. 자동 실행 검증
9. 기존 test/scenario/monitor 동작 재검증

---

## 3. 제외 범위

Phase-b-02에서 하지 않을 것:

- CDP Chrome을 launchd로 자동 시작
- macOS 앱 패키징
- Automator/Shortcuts 생성
- Chrome Extension
- VPS/미니PC 운영
- event detection policy 변경
- parser 구조 변경
- Discord message policy 변경
- database 추가
- dashboard 추가

주의:

- CDP Chrome 자동 시작은 Phase-b-01에서 수동 starter로 해결했다.
- launchd는 monitor 자동 실행만 담당한다.
- Chrome CDP가 꺼져 있으면 monitor의 기존 diagnostic/rate-limit 정책이 작동해야 한다.

---

## 4. 목표 사용자 흐름

Phase-b-02 완료 후 사용자 흐름:

1. MacBook을 켠다.
2. `Mongi Start.command` 또는 `npm run start:chrome`으로 CDP Chrome을 연다.
3. Codex/Claude 로그인 상태를 확인한다.
4. launchd가 10분마다 monitor를 자동 실행한다.
5. Discord에서 몽이 알림을 받는다.

설치 후 평소에는:

- monitor를 직접 실행할 필요가 없다.
- 로그는 `logs/launchd-out.log`, `logs/launchd-error.log` 등에서 확인한다.

---

## 5. 파일 구조 요구사항

생성 또는 수정할 파일:

- `launchd/com.donghoon.mongi-usage-coach.plist.template`
- `scripts/install-launchd.sh`
- `scripts/uninstall-launchd.sh`
- `scripts/check-launchd-status.sh`
- `scripts/run-monitor.sh`
- `package.json`
- `README.md`

선택:

- `launchd/README.md`
- `scripts/tail-launchd-logs.sh`

---

## 6. package.json scripts 요구사항

추가 scripts:

- `launchd:install`
- `launchd:uninstall`
- `launchd:status`
- `launchd:logs`
- `monitor:run`

예상 매핑:

- `launchd:install` -> `bash scripts/install-launchd.sh`
- `launchd:uninstall` -> `bash scripts/uninstall-launchd.sh`
- `launchd:status` -> `bash scripts/check-launchd-status.sh`
- `launchd:logs` -> `tail -n 100 -f logs/launchd-out.log logs/launchd-error.log`
- `monitor:run` -> `bash scripts/run-monitor.sh`

기존 scripts 유지:

- `start:chrome`
- `check:cdp`
- `monitor`
- `debug:page-text`
- `test:state`
- `test:discord`
- `test:scenarios`

---

## 7. run-monitor.sh 요구사항

`scripts/run-monitor.sh`는 launchd가 직접 실행할 wrapper다.

필수 동작:

1. 프로젝트 루트로 이동
2. Node/npm 경로 문제 방지
3. logs directory 생성
4. timestamp 출력
5. `npm run monitor` 실행
6. exit code 출력
7. 환경변수 로딩은 기존 Node config에 맡김

왜 wrapper가 필요한가:

launchd는 interactive shell과 PATH가 다르다.  
따라서 npm/node 경로 문제를 줄이기 위해 wrapper에서 PATH를 명시적으로 설정한다.

권장 PATH:

/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

주의:

- `.env` 내용을 출력하지 않는다.
- Discord Webhook URL 출력 금지.
- 실패해도 로그에 원인이 남아야 한다.

---

## 8. launchd plist 요구사항

plist는 사용자 LaunchAgent로 설치한다.

위치:

`~/Library/LaunchAgents/com.donghoon.mongi-usage-coach.plist`

Label:

`com.donghoon.mongi-usage-coach`

기본 실행 간격:

- 600초
- 즉 10분마다 실행

필수 설정:

- Label
- ProgramArguments
- WorkingDirectory
- StartInterval
- RunAtLoad
- StandardOutPath
- StandardErrorPath

ProgramArguments는 shell wrapper를 실행하도록 한다.

예시 의미:

- `/bin/bash`
- `/absolute/path/to/project/scripts/run-monitor.sh`

주의:

- plist에는 상대 경로를 넣지 않는다.
- install script가 현재 프로젝트 경로를 절대경로로 template에 주입해야 한다.
- plist 파일 안에 Webhook URL이나 secret을 넣지 않는다.

---

## 9. install-launchd.sh 요구사항

`scripts/install-launchd.sh` 동작:

1. 프로젝트 루트 계산
2. 필요한 파일 존재 확인
3. `scripts/run-monitor.sh` 실행 권한 설정
4. `~/Library/LaunchAgents` 생성
5. plist template에서 프로젝트 절대경로 치환
6. 기존 같은 Label이 로드되어 있으면 unload
7. plist 복사/생성
8. launchctl load 또는 bootstrap 사용
9. launchd 상태 확인
10. 설치 완료 안내 출력

macOS 버전에 따라 `launchctl load` 또는 `launchctl bootstrap gui/$UID` 중 Agent가 판단해 안정적인 방식을 사용한다.

권장:

- 단순성을 위해 현재 macOS에서 잘 작동하는 방식을 선택
- 실패 시 대체 명령을 README에 안내

설치 후 안내:

- `npm run launchd:status`
- `npm run launchd:logs`
- `npm run start:chrome`

---

## 10. uninstall-launchd.sh 요구사항

`scripts/uninstall-launchd.sh` 동작:

1. Label 확인
2. launchd unload 또는 bootout
3. plist 파일 제거 여부는 기본적으로 제거
4. logs는 삭제하지 않음
5. 완료 안내 출력

주의:

- state.json은 삭제하지 않는다.
- `.env`는 삭제하지 않는다.
- browser profile은 삭제하지 않는다.

---

## 11. check-launchd-status.sh 요구사항

`scripts/check-launchd-status.sh` 동작:

1. launchctl list에서 Label 확인
2. plist 파일 존재 확인
3. 로그 파일 존재 확인
4. 최근 로그 일부 출력 가능
5. CDP status도 선택적으로 확인

출력 예시:

- LaunchAgent loaded: yes/no
- Plist path: ...
- Last log files: ...
- CDP reachable: yes/no

주의:

- CDP가 꺼져 있어도 launchd 설치 실패로 간주하지 않는다.
- CDP는 starter로 별도 실행하는 구조다.

---

## 12. launchd logs

기본 로그 파일:

- `logs/launchd-out.log`
- `logs/launchd-error.log`

wrapper log도 같은 파일에 남겨도 된다.

README에 포함:

- 로그 보기: `npm run launchd:logs`
- 최근 로그 보기: `tail -n 100 logs/launchd-out.log`
- 에러 보기: `tail -n 100 logs/launchd-error.log`

---

## 13. CDP Chrome이 꺼져 있을 때

launchd는 monitor만 실행한다.  
CDP Chrome이 꺼져 있으면 monitor는 실패 또는 diagnostic event를 생성할 수 있다.

요구사항:

- launchd wrapper는 실패를 숨기지 않는다.
- monitor가 이미 가지고 있는 rate-limited diagnostic 정책을 사용한다.
- 매 10분마다 Discord 스팸을 보내면 안 된다.

검증:

- CDP Chrome 켜진 상태에서 monitor 정상
- CDP Chrome 꺼진 상태에서 wrapper/monitor가 graceful failure
- diagnostic은 rate-limited

---

## 14. README 업데이트 요구사항

README에 새 섹션 추가:

“Automatic monitor with launchd”

포함 내용:

1. launchd가 하는 일
2. launchd가 하지 않는 일
3. 설치 명령
4. 해제 명령
5. 상태 확인 명령
6. 로그 확인 명령
7. CDP Chrome starter와의 관계
8. Mac이 꺼져 있으면 작동하지 않는다는 점
9. Chrome CDP가 꺼져 있으면 monitor는 diagnostic만 남긴다는 점
10. Troubleshooting

Troubleshooting:

- launchd가 실행되지 않음
- npm/node 경로 문제
- permission denied
- plist 경로 문제
- 로그가 비어 있음
- CDP unreachable
- Discord 알림이 안 옴
- quiet hours 때문에 알림이 suppress됨

---

## 15. 보안 요구사항

launchd plist와 script에 secret을 넣지 않는다.

금지:

- DISCORD_WEBHOOK_URL을 plist에 직접 넣기
- `.env` 내용을 로그에 출력
- browser-profile 경로를 Git에 포함
- state/logs를 커밋

허용:

- 프로젝트 절대 경로
- 로그 파일 경로
- CDP URL `http://127.0.0.1:9222`

---

## 16. 검증 명령

Agent는 작업 후 최소 아래 명령을 실행한다.

chmod +x scripts/run-monitor.sh
chmod +x scripts/install-launchd.sh
chmod +x scripts/uninstall-launchd.sh
chmod +x scripts/check-launchd-status.sh

bash -n scripts/run-monitor.sh
bash -n scripts/install-launchd.sh
bash -n scripts/uninstall-launchd.sh
bash -n scripts/check-launchd-status.sh

npm run test:state
npm run test:scenarios
npm run check:cdp
npm run monitor:run

가능하면 실제 설치 검증:

npm run launchd:install
npm run launchd:status
npm run launchd:logs

설치 후 바로 한 번 실행 확인:

- RunAtLoad로 한 번 실행되는지 확인
- logs에 monitor run이 남는지 확인

그리고 정리 여부는 사용자 지시에 따른다.  
기본은 설치 상태 유지 가능.

---

## 17. 성공 기준

Phase-b-02 완료 조건:

1. launchd plist template이 존재한다.
2. install/uninstall/status scripts가 존재한다.
3. run-monitor wrapper가 존재한다.
4. `npm run launchd:install`로 LaunchAgent 설치가 가능하다.
5. `npm run launchd:status`로 상태 확인이 가능하다.
6. `npm run launchd:logs`로 로그 확인이 가능하다.
7. RunAtLoad 또는 StartInterval에 의해 monitor가 자동 실행된다.
8. 로그에 monitor 실행 기록이 남는다.
9. 기존 `npm run monitor`가 깨지지 않는다.
10. README에 설치/해제/문제해결이 문서화된다.

---

## 18. 완료 보고 형식

Agent는 작업 완료 후 아래 형식으로 보고한다.

Phase-b-02 Report

1. Files created/changed
- ...

2. Commands run
- ...

3. Passed
- ...

4. Failed / Not verified
- ...

5. launchd result
- installed/not installed
- loaded yes/no
- RunAtLoad executed yes/no
- log files created yes/no

6. Monitor automation result
- latest run status
- CDP reachable yes/no
- notification behavior

7. Manual verification
- ...

8. Next recommended phase
- Phase-b-03 — Local automation validation and usability hardening

주의:

- Discord Webhook URL을 보고하지 말 것.
- `.env` 내용을 보고하지 말 것.
- cookies/session data를 보고하지 말 것.
- full logs를 불필요하게 붙이지 말 것.

---

## 19. 핵심 판단

Phase-b-02는 Mongi Usage Coach를 “수동 실행 도구”에서 “로컬 자동 감시 도구”로 바꾸는 단계다.

다만 이 자동화는 조건부다.

- Mac이 켜져 있어야 한다.
- 사용자가 로그인되어 있어야 한다.
- CDP Chrome이 열려 있어야 한다.

이 한계를 숨기면 안 된다.  
대신 one-click starter와 launchd를 조합해 매일 쓰기 쉬운 루틴으로 만든다.