# Phase V3-F Report

QA / Release Candidate / 개인 배포 정리

## 1. Files created / changed

변경:

- `package.json` — version `0.1.0` → `3.0.0-rc.1`.
- `scripts/package-mongi-app.sh` — Info.plist 버전을 하드코딩 대신 `package.json`에서 읽어 주입 (`CFBundleShortVersionString`, `CFBundleVersion`). `MONGI_APP_VERSION`/`MONGI_APP_BUILD`로 override 가능.

신규:

- `CHANGELOG.md` — V3 변경 사항(Phase A~F) 요약.
- `known-issues.md` — 9개 known issue (증상/영향/workaround/후속).
- `README.md` — "V3 Release Candidate (Phase F)" 섹션 + TOC 항목 추가 (RC 실행법, 보안/프라이버시, V3.1/V4 backend 방향). 기존 Phase E 섹션도 TOC에 반영.
- `v3/reports/phase-v3-f_REPORT.md` — 본 보고서.

릴리즈 산출물:

- `dist/Release/Mongi.app` (3.0.0-rc.1)
- `dist/Mongi-v3-rc.1/` (스테이징: Mongi.app + README + CHANGELOG + known-issues)
- `dist/Mongi-v3-rc.1.zip` (4.3MB)

이번 Phase에서 **소스 코드(src/, Swift)는 변경하지 않았다.** 안정화 단계 방침대로 기능 추가 없이 검증/문서/버전/패키징만 정리했다.

## 2. Release version

- `3.0.0-rc.1`
- 표시 위치: `package.json`, `Info.plist`(`CFBundleShortVersionString=3.0.0-rc.1`, `CFBundleVersion=빌드타임스탬프`), Diagnostics Window header(Bundle에서 읽음), README, CHANGELOG.

## 3. QA checklist summary

| # | 시나리오 | 결과 |
|---|----------|------|
| 4.1 | Fresh Install | PASS |
| 4.2 | Normal Usage | PASS |
| 4.3 | Browser Stale Recovery | PASS (scenario harness + live CDP-failure) |
| 4.4 | Browser Missing | PASS (scenario harness) |
| 4.5 | Monitor Crash | PASS |
| 4.6 | App Restart | PASS |
| 4.7 | Login Restart | PARTIAL (ON/OFF wiring 검증, 로그아웃/재부팅 미검증 → known issue #6) |
| 4.8 | Node Missing | PASS |
| 4.9 | Long Run | PARTIAL (~3.5분 sustained proxy 수행, 2h+ 미수행 → known issue #7) |
| 4.10 | UI Review | PASS (코드 리뷰; 라이브 스크린샷은 automation 불가) |

## 4. Scenario results (상세)

### 4.1 Fresh Install — PASS
- `~/Library/Application Support/Mongi`, `~/Library/Logs/Mongi` 백업 후 제거하고 `open -n dist/Release/Mongi.app`.
- 자동 생성 확인: `state.json`(version 3, codex/claude services+sources), `runtime.json`, `monitor.lock`, `monitor.log`.
- 앱 crash 없음, monitor 자동 시작(`status=running`, `owner=Mongi.app`, `mode=loop`), `error.log` 없음.

### 4.2 Normal Usage — PASS
- 실제 CDP Chrome 세션에서 Codex/Claude 모두 `backend=cdp`, `status=healthy`, `freshness=fresh`.
- usage 값 표시(codex short 91/weekly 45, claude short 71/weekly 90), `lastFreshReadAt` 갱신.

### 4.3 Browser Stale Recovery — PASS
- 결정적 메커니즘은 scenario harness로 검증: last value 보존, consecutiveFailures 증가, threshold reload 시도, reload cooldown, target rediscovery.
- 추가 live 검증: dead CDP endpoint(`127.0.0.1:59999`)로 single-shot 실행 → 앱/monitor crash 없이 exit 0, usage 보존, status/freshness=`stale`, consecutiveFailures=1.

### 4.4 Browser Missing — PASS
- scenario "V3 missing target records missing status and preserves stale value"로 검증: missing/stale 표시 + 기존 usage 유지 + crash 없음. 탭 재오픈 시 target rediscovery 복구(scenario).
- 사용자 라이브 탭을 닫는 조작은 사용자 CDP 세션 보호를 위해 harness로 대체.

### 4.5 Monitor Crash — PASS
- 실제 RC 앱 실행 중 monitor `kill -9`.
- runtime: `recorded=failed`, `effective=failed`, `pidAlive=false`, `lastError="monitor exited with code 9"`. monitor 프로세스 없음, **앱은 생존**.

### 4.6 App Restart — PASS
- 앱 종료 → orphan monitor 없음(clean), 앱 종료 확인.
- 재실행 → monitor 재시작(`effective=running`, 새 pid, `owner=Mongi.app`).
- state 보존(version 3, usage 동일), corruption 없음. crash가 남긴 stale lock(dead pid)은 새 monitor가 교체.

### 4.7 Login Restart — PARTIAL
- Diagnostics `Background` 탭 토글과 `SMAppService.currentState()` 읽기는 build/런타임 init에서 동작(앱 정상 실행). enable/disable은 do/catch로 graceful.
- 로그아웃/재부팅 자동 실행은 이번 환경(ad-hoc 서명)에서 끝까지 검증하지 못함 → known issue #6, 후속 정식 서명 빌드에서 확인.

### 4.8 Node Missing — PASS
- `MONGI_NODE_CANDIDATES=/tmp/definitely-not-node`로 앱 바이너리 직접 실행.
- 앱 crash 없음, runtime `status=failed`/`lastError="node not found"`, `error.log`에 "MonitorRunner failure: node not found" 기록, monitor leak 없음.

### 4.9 Long Run — PARTIAL
- 60초 poll 강제 sustained proxy ~3.5분(6 polls):
  - app CPU 0.0~0.2%, RSS 76~100MB(안정/감소).
  - monitor CPU idle 0%, poll 중 ~10%, RSS 145→100MB(누수 없음).
  - heartbeat 지속 갱신, state corruption 없음.
  - 실제 reload action 0건(`lastRecoveryAction:null`/`lastReloadAt:null`만) → reload loop 없음.
  - log growth ~4KB/poll(default 10분 poll 기준 ~24KB/h). 로그 rotation 미구현은 minor risk.
- 2시간+ 연속 실행은 미수행 → known issue #7, 실사용 중 관측 권장.

### 4.10 UI Review — PASS (코드 리뷰)
- 메뉴(MenuBarStatusView): 상태 indicator(CDP/monitor/launchd) + 소수 액션(시작/새로고침/전체 앱 열기/상태 점검/오늘 요약). 긴 에러를 메뉴에 노출하지 않음.
- 상세 진단은 Diagnostics Window(Overview/Sources/Recovery/Runtime/Background/Actions/Logs)로 분리.
- Copy Diagnostics Summary와 표시 값은 redaction 적용.

## 5. Commands run

- `node -c`: `src/monitor.js`, `src/runtime/monitorLock.js`, `src/runtime/runtimeMeta.js`, `src/runtime/paths.js`, `scripts/health-check.js`, `scripts/status-json.js`, `scripts/test-scenarios.js`.
- `bash -n`: `run-monitor.sh`, `package-mongi-app.sh`, `build-monitor-dist.sh`, `install-launchd.sh`, `uninstall-launchd.sh`.
- `npm run test:scenarios` (11 V3 시나리오 포함 전체 통과), `npm run test:state`, `npm run status:json`, `npm run health`.
- `npm run release:local` (RC 빌드), `ditto`로 zip 생성.
- 실 QA: `open -n dist/Release/Mongi.app`, `kill -9 <monitor>`, dead CDP endpoint 실행, bad node 실행, sustained sampling.

## 6. Verification results

- JS 문법/시나리오/state: 전부 통과.
- Swift: Phase E에서 `swift build`/`swift test`(9) 통과, 이번 Phase 소스 무변경.
- 패키징: `dist/Release/Mongi.app` 생성, `CFBundleShortVersionString=3.0.0-rc.1` 확인, ad-hoc codesign(`com.donghoon.mongi`, arm64).
- 번들 검사: `.env`/state/config/runtime/commands/lock 없음, `policy.example.json`만 포함, node_modules 17MB.

## 7. Release blockers found

**없음.** Spec §6의 11개 blocker 기준을 모두 통과:

1. Xcode 없이 실행 — PASS (`open -n`, ad-hoc 서명)
2. monitor 자동 시작 — PASS
3. monitor 중복 실행 — 방지됨 (lock + runtime pid)
4. state/runtime corruption — 없음 (재시작 후 version 3 보존)
5. 앱 종료 후 orphan — 없음
6. CDP failure → crash — 없음 (graceful degrade)
7. 무한 reload — 없음 (actual reload 0건)
8. Diagnostics Window 열기 — 동작 (build/Phase D·E)
9. Login Item ON이 앱 실행 파손 — 없음 (graceful, 앱 정상)
10. token/cookie/auth 노출 — 없음
11. CPU/memory 비정상 — 없음 (idle ~0%, RSS 안정)

## 8. Fixes applied

- release blocker로 인한 코드 수정은 없었다.
- 안정화 정리: 앱 버전 RC 표기(package.json + Info.plist 주입). 기능/로직 변경 아님.

## 9. Known issues

`known-issues.md` 참조 (9건, 모두 non-blocker):

1. CDP Chrome remote debugging 필요
2. 탭 닫힘 시 stale/missing
3. 서비스 UI 변경 시 parser 업데이트
4. bundled node 미지원
5. notarization/DMG 미완료
6. Login Item 로그아웃/재부팅 자동 실행 미검증(RC 환경)
7. 2시간+ Long Run 미수행
8. Mac sleep/종료 시 monitoring 정지
9. 특정 브라우저 CDP target detection 제한

## 10. Security / privacy review

- 실제 logs/state/runtime/commands에서 Discord webhook, cookie, authorization/bearer, sk-/JWT 토큰, password **미발견**.
- redaction 3중: JS logger(키 `secret|token|webhook|password|authorization|cookie`), Swift `ShellResult.sanitize`(Discord webhook URL/env, Bearer/Basic, key=value), `DiagnosticsRedactor`(access/refresh/id token, session, Bearer/Basic).
- 외부 전송: Discord Webhook(사용자 `.env`에만 존재, app-managed monitor는 기본 dry-run)뿐. 그 외 외부 서버 전송 없음.
- CDP endpoint는 로컬 `127.0.0.1:9222`만 사용 — README에 로컬 한정/외부 비개방 명시.
- 번들에 `.env`/개인 runtime 파일 미포함. zip에도 개인 runtime/log 미포함.

## 11. Performance review (Activity Monitor / ps 기준)

- idle app CPU: ~0%.
- monitor: idle 0%, poll 중 짧게 ~10% 후 복귀.
- memory: app RSS 76~100MB, monitor RSS 100~145MB — 관측 구간 내 누수 없음(오히려 감소).
- log growth: ~4KB/poll. 로그 rotation 없음(minor risk, known issue 후보).
- reload frequency: healthy 상태에서 0건.
- 장시간 안정성: ~3.5분 proxy 안정. 2h+는 미수행(risk).

## 12. Release artifact path

- 앱: `/Users/shadowmoon/nonoNangbi/nonoNangbi/dist/Release/Mongi.app`
- zip: `/Users/shadowmoon/nonoNangbi/nonoNangbi/dist/Mongi-v3-rc.1.zip` (4.3MB)
- 문서: `README.md`, `CHANGELOG.md`, `known-issues.md` (repo root, zip 동봉)
- 보고서: `v3/reports/phase-v3-f_REPORT.md`

## 13. Remaining risks

- Login Item end-to-end(로그아웃/재부팅) 미검증 — ad-hoc 서명에서 `SMAppService.register()` 승인/실패 가능성. 앱은 graceful하므로 실행 파손 위험은 낮음.
- 2시간+ Long Run 미수행 — 초장기 memory/log 거동 불확실(단시간엔 안정).
- 로그 rotation 미구현 — 장기적으로 monitor.log 누적.
- CFBundleShortVersionString에 `-rc.1` 포함 — 로컬/개인 배포엔 무해하나 App Store 제출엔 부적합(해당 없음).
- launchd LaunchAgent가 사용자 환경에 load되어 있음 — lock으로 동시 polling은 방지되나, Login Item 상시 사용 시 `npm run launchd:uninstall` 권장(README/known-issues 문서화).

## 14. V3 RC readiness

**Ready (개인 실사용 RC).** 핵심 QA PASS, release blocker 0, 보안/성능 review 완료, 문서·버전·아티팩트 정리 완료. PARTIAL 2건(Login restart, Long run)은 환경 제약으로 known issue/risk로 명시했고 blocker 아님.

## 15. Recommended next phase

- V3.1 spike: CDP 비의존 backend 조사(Claude statusLine, Codex CLI/wham) — 별도 spike, production 전환은 별도 결정.
- 정식 코드 서명 + notarization → Login Item end-to-end 및 Gatekeeper 검증.
- 로그 rotation(크기/일자 기준) 추가 — 장기 실행 대비 minor 개선.
- 실사용 2h+ Long Run 관측 후 결과 기록.
