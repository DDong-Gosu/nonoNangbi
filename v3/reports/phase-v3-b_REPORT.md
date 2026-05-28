# V3 Phase B Report — Usage Backend Reliability Layer

## 목차

- 구현 요약
- Files created / changed
- State schema
- Recovery behavior
- Verification results
- Commands run
- What passed
- What failed or remains uncertain
- Manual verification
- Next recommended phase

## 구현 요약

V3 Phase B 목표인 Usage Backend Reliability Layer를 구현했다.

- Production backend는 CDP로 유지했다.
- CDP 수집을 `UsageBackend` abstraction 뒤의 `CDPBackend`로 감쌌다.
- Codex와 Claude 모두 동일한 recovery flow를 사용한다.
- 첫 실패에서 usage 값을 지우지 않고 last known good value를 유지한다.
- `sources.codex` / `sources.claude`에 backend/status/freshness/recovery metadata를 저장한다.
- Target rediscovery, reload threshold, reload cooldown을 공통 recovery flow에 포함했다.
- Swift menu UI가 읽는 기존 `services.codex` / `services.claude` 구조는 유지했다.
- Claude statusLine, Codex wham, Cursor DB, WKWebView, Browser Extension은 구현하지 않았다.

## Files created / changed

Created:

- `src/backends/usageBackend.js`
- `src/backends/cdpBackend.js`
- `v3/reports/phase-v3-b_REPORT.md`

Changed:

- `src/services.js`
- `src/monitor.js`
- `src/extractors/usageExtractor.js`
- `src/state/stateStore.js`
- `src/state/serviceStateUpdater.js`
- `scripts/status-json.js`
- `scripts/health-check.js`
- `scripts/test-scenarios.js`
- `macos/Mongi/Mongi/Models/MongiStatus.swift`
- `README.md`

## State schema

State version은 `3`으로 정규화된다.

기존 menu/status 호환성을 위해 아래 구조는 유지했다.

- `services.codex`
- `services.claude`

새 reliability metadata는 아래에 추가했다.

- `sources.codex`
- `sources.claude`

Source field:

- `source`: source key.
- `backend`: production 값은 `cdp`.
- `status`: `healthy`, `degraded`, `stale`, `reconnecting`, `refreshing`, `missing`, `failed`, `disabled`.
- `freshness`: `fresh`, `stale`, `unknown`, `disabled`.
- `usage`: 마지막 fresh read의 normalized usage.
- `lastFreshReadAt`: 마지막 fresh read 시각.
- `lastAttemptAt`: 마지막 read 시도 시각.
- `consecutiveFailures`: source별 연속 실패 수.
- `lastError`: 마지막 실패 이유.
- `lastRecoveryAction`: 최근 recovery 결과.
- `lastReloadAt`: 마지막 reload 시도 시각.
- `target`: 선택된 CDP target metadata.

## Recovery behavior

CDPBackend flow:

1. Initial read 성공 시 `healthy` / `fresh`로 기록하고 failure count를 0으로 리셋한다.
2. Initial read 실패 시 usage는 유지하고 retry를 수행한다.
3. Retry 실패 시 target rediscovery를 수행한다.
4. Rediscovery target이 있으면 다시 read를 시도한다.
5. 계속 실패하면 source별 threshold와 cooldown을 확인한다.
6. 조건 충족 시 `Page.reload` 흐름을 수행하고 source별 wait 후 read를 재시도한다.
7. Reload 성공 시 `reload-success`, 실패 시 `reload-failed`를 기록한다.
8. Cooldown 중이면 `reload-skipped-cooldown`을 기록하고 중복 reload하지 않는다.

Reload policy:

- Codex: `consecutiveFailures >= 3`
- Claude: `consecutiveFailures >= 2`
- Same source cooldown: 5분
- Reload in progress 중복 방지: source key 기준 in-memory guard

## Verification results

Live CDP read:

- Codex initial read 성공.
- Claude initial read 성공.
- `sources.codex.status = healthy`
- `sources.codex.freshness = fresh`
- `sources.claude.status = healthy`
- `sources.claude.freshness = fresh`

Scenario coverage:

- Last known usage 유지.
- Source `consecutiveFailures` 증가.
- Codex threshold 도달 시 reload 시도.
- Claude reload cooldown 동작.
- Target rediscovery 후 read 재시도.
- Target missing 시 `missing` 기록.
- 기존 stale provider 값은 Discord usage line에서 생략.

Health/status:

- `npm run health`에서 CDP target list, Codex target, Claude target, backend/status/freshness, reload cooldown을 확인할 수 있다.
- `npm run status:json`에서 usage source별 backend/status/freshness/recovery metadata를 확인할 수 있다.
- Swift model은 새 optional fields를 decode할 수 있고 기존 UI 표시 구조는 유지된다.

## Commands run

- `node -c src/backends/usageBackend.js` — pass
- `node -c src/backends/cdpBackend.js` — pass
- `node -c src/state/stateStore.js` — pass
- `node -c src/state/serviceStateUpdater.js` — pass
- `node -c src/monitor.js` — pass
- `node -c scripts/status-json.js` — pass
- `node -c scripts/health-check.js` — pass
- `node -c scripts/test-scenarios.js` — pass
- `npm run test:scenarios` — pass
- `npm run test:state` — pass
- `npm run status:json` — pass
- `npm run health` — pass
- `swift build` — pass
- `swift test` — pass, 9 tests
- `npm run monitor -- --dry-run-notifications` — pass
- `npm run check:cdp` — pass
- `git diff --check` — pass

## What passed

- CDPBackend가 UsageBackend abstraction 뒤에서 동작한다.
- Codex와 Claude 모두 같은 recovery flow를 사용한다.
- Codex와 Claude 모두 source별 failure counter를 가진다.
- Last known value가 실패 시 유지된다.
- `status`와 `freshness`로 값의 신뢰도를 표현한다.
- Target rediscovery가 reload보다 먼저 실행된다.
- Reload threshold와 cooldown이 scenario에서 검증됐다.
- Health check에서 backend/status/freshness를 볼 수 있다.
- Swift build/test가 통과해 menu UI decode 호환성이 유지된다.

## What failed or remains uncertain

- 실제 운영 탭에 강제 reload failure를 만들지는 않았다. 사용 중인 Codex/Claude 탭을 불필요하게 흔들지 않기 위해 reload threshold/cooldown은 mock scenario로 검증했다.
- Xcode GUI 앱 직접 실행은 수행하지 않았다. Swift build/test와 `status:json` decode 호환성으로 검증했다.
- Launchd 자체 동작 변경은 Phase B 범위가 아니므로 수정하지 않았다.

## Manual verification

1. `npm run health`
2. Usage 섹션에서 Codex/Claude의 `backend cdp`, `status`, `freshness`, `reload cooldown` 확인.
3. `npm run status:json`
4. `usage.codex.backend/status/freshness`와 `usage.claude.backend/status/freshness` 확인.
5. `~/Library/Application Support/Mongi/state.json`에서 `sources.codex` / `sources.claude` 확인.
6. Xcode에서 macOS app 실행 후 menu bar usage가 기존처럼 표시되는지 확인.

## Next recommended phase

V3 Phase C로 진행한다.

추천 범위:

- App packaging 안정화.
- Runtime path와 bundled Node command 연결 검증.
- Phase B의 reliability metadata를 packaging 환경에서도 동일하게 읽는지 확인.
