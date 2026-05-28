# Known Issues — Mongi V3 (3.0.0-rc.1)

개인 실사용 RC 기준의 알려진 문제와 한계다. 각 항목은 증상 / 영향 / 임시 해결 / 후속 계획 순으로 적는다. 여기 적힌 항목은 release blocker가 아니다 (blocker는 RC 전에 수정).

## 1. CDP Chrome remote debugging 필요

- 증상: CDP Chrome(`--remote-debugging-port=9222`)이 떠 있지 않으면 usage를 읽지 못한다.
- 영향: monitor가 `cdp_unreachable`로 degrade. 기존 usage는 stale로 보존되고 앱은 crash하지 않는다.
- 임시 해결: `npm run start:chrome`로 CDP Chrome을 띄우고 Codex/Claude usage page에 로그인.
- 후속 계획: V3.1/V4에서 CDP 비의존 backend(statusLine/CLI/WKWebView) spike.

## 2. 대상 탭이 닫히면 usage가 stale/missing

- 증상: Codex 또는 Claude usage 탭을 닫으면 해당 source가 `missing`/`stale`로 표시된다.
- 영향: 새 fresh 값이 안 들어오지만 마지막 값은 유지되고, 앱/모니터는 정상.
- 임시 해결: 탭을 다시 열면 target rediscovery로 복구된다. Diagnostics `Actions`의 Reload/Reconnect도 사용 가능.
- 후속 계획: 탭 자동 재오픈 정책은 보류(monitor는 새 탭을 강제로 열지 않는 정책).

## 3. 서비스 UI 변경 시 parser 업데이트 필요

- 증상: Codex/Claude usage page DOM/문구가 바뀌면 parse confidence가 떨어지거나 실패할 수 있다.
- 영향: 해당 source가 stale/failed로 표시될 수 있다. 앱은 crash하지 않는다.
- 임시 해결: `npm run debug:codex` / `npm run debug:claude`로 페이지 텍스트를 확인하고 parser를 갱신.
- 후속 계획: parser fixture 회귀 테스트 유지(`npm run test:scenarios`).

## 4. bundled node 미지원

- 증상: 앱은 시스템 node(`/opt/homebrew/bin/node`, `/usr/local/bin/node`, `/usr/bin/node`, `/usr/bin/env node`)에 의존한다.
- 영향: node가 없거나 GUI PATH에서 못 찾으면 monitor가 `failed`("node not found")로 기록된다. 앱은 crash하지 않는다.
- 임시 해결: node 설치 또는 `MONGI_NODE_CANDIDATES`로 경로 지정. error.log/Diagnostics에서 원인 확인.
- 후속 계획: V4에서 bundled node 검토.

## 5. notarization / DMG installer 미완료

- 증상: 앱은 ad-hoc 서명만 되어 있고 notarized DMG 배포본이 아니다.
- 영향: 처음 실행 시 Gatekeeper 경고가 날 수 있다. Login Item 등록이 서명 상태에 따라 승인을 요구하거나 제한될 수 있다.
- 임시 해결: 우클릭 > 열기로 첫 실행 허용. Login Item은 시스템 설정 > 일반 > 로그인 항목에서 승인.
- 후속 계획: V4에서 notarization/DMG.

## 6. Login Item 로그아웃/재부팅 자동 실행 미검증 (RC 환경)

- 증상: Start at Login ON/OFF 토글과 상태 표시는 동작하지만, 실제 로그아웃/재부팅 후 자동 실행은 이번 RC 검증 환경에서 끝까지 확인하지 못했다.
- 영향: ad-hoc 서명 빌드에서는 `SMAppService.register()`가 승인 대기 또는 실패할 수 있다(앱은 graceful하게 에러만 표시하고 깨지지 않음).
- 임시 해결: 토글 ON 후 시스템 설정 > 일반 > 로그인 항목에서 Mongi 허용 여부 확인.
- 후속 계획: 정식 서명 빌드에서 로그인 자동 실행 end-to-end 검증.

## 7. 장시간(2시간+) Long Run 미수행

- 증상: 이번 RC에서는 단시간(수 분, 60초 poll 강제) sustained run만 수행했다. 장시간 검증은 일정상 생략.
- 영향: 매우 긴 시간의 memory 누수/로그 폭증 가능성은 완전히 배제하지 못했다(단시간 관측에서는 안정적).
- 임시 해결: Diagnostics `Background`에서 heartbeat age와 effective status로 상태를 주기적으로 확인.
- 후속 계획: 실사용 중 Activity Monitor로 장시간 관측, 이상 시 issue로 기록.

## 8. Mac sleep/종료 시 monitoring 정지

- 증상: Mac이 sleep/off면 monitor polling이 멈춘다.
- 영향: 그 시간 동안 usage가 갱신되지 않는다.
- 임시 해결: 깨어나면 monitor가 다시 polling한다. 필요 시 Diagnostics에서 Refresh Now.
- 후속 계획: always-on 인프라는 V1~V4 범위 밖.

## 9. 특정 브라우저/환경 CDP target detection 제한

- 증상: 일부 Chrome 변형/프로필에서 CDP target(usage 탭) 인식이 제한될 수 있다.
- 영향: source가 missing으로 표시될 수 있다.
- 임시 해결: `npm run check:cdp`로 연결 확인, usage URL이 정확한 탭을 열어둔다.
- 후속 계획: target 매칭 휴리스틱 개선.
