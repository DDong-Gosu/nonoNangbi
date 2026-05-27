Phase-v2-06d Report

1. Files created/changed
- README.md
- package.json
- scripts/verify-usage-source.js
- scripts/debug-page-text.js
- scripts/health-check.js
- scripts/status-json.js
- scripts/test-scenarios.js
- src/extractors/usageExtractor.js
- src/monitor.js
- src/notifications/messages.js
- src/parsers/common.js
- src/parsers/codexParser.js
- src/parsers/claudeParser.js
- src/state/serviceStateUpdater.js
- src/state/stateStore.js
- macos/Mongi/Mongi/Models/MongiStatus.swift
- macos/Mongi/Mongi/Views/MenuBarStatusView.swift
- v2/reports/phase-v2-06d_REPORT.md

2. Root cause investigation
- Source binding: root cause는 parser 단독 문제가 아니라 live tab을 reload하지 않아 stale DOM/state를 fresh처럼 보여준 것이었다. 최초 status-json은 Codex 99/69, Claude 100/100이었지만, 새 verify command가 같은 CDP target을 reload하자 Claude는 50%/7% used로 즉시 바뀌었다.
- Stale state: 기존 `updateServiceState`는 parse 실패 시에도 `lastCheckedAt`을 갱신했다. 이제 실패는 `lastAttemptedAt`, `lastParseFailedAt`만 갱신하고 `lastSuccessfulCheckedAt`은 보존한다.
- Parser: Codex/Claude parser의 의미 변환은 유지했다. 새 screenshot fixture 기준 Codex 85/51 remaining, Claude 50/7 used -> 50/93 remaining을 scenario로 고정했다.
- UI: status-json과 Swift model에 stale/source/freshness 필드를 추가했다. menu bar는 stale 또는 실패 시 `확인 필요`를 보여준다.
- Discord: stale provider나 parse failure provider는 usage line에서 생략한다. 오래된 값을 fresh 값처럼 보내지 않는다.

3. Live source verification
- Codex selected source: CDP `http://127.0.0.1:9222`, target `ACD5E6E80CD15F9579251021F0CCA20C`, title `Codex`, URL `https://chatgpt.com/codex/cloud/settings/analytics`, exact configured URL match, existing tab reused and reloaded.
- Codex extracted values: reload 후 live 값은 계속 사용 중이라 73/49 -> 68/48 -> 64/48 -> 62/47 -> app refresh 후 status-json 58/47 remaining으로 감소했다. 이는 stale 99/69가 아니라 live page를 다시 읽고 있음을 보여준다.
- Codex status-json/menu values: 최신 status-json은 Codex short 58, weekly 47, stale false, lastSuccessfulCheckedAt 있음, selected source metadata 있음. Menu bar는 같은 status-json을 decode한다.
- Claude selected source: CDP `http://127.0.0.1:9222`, target `4F642147CD063AA759EC1A843B6D9EC8`, title `Settings - Claude`, URL `https://claude.ai/settings/usage`, exact configured URL match, existing tab reused and reloaded.
- Claude extracted values: current session 50% used, all models 7% used, normalized remaining 50/93.
- Claude status-json/menu values: 최신 status-json은 Claude remaining 50/93, used 50/7, stale false, lastSuccessfulCheckedAt 있음, selected source metadata 있음. Menu bar는 같은 status-json을 decode한다.

4. Fixes applied
- CDP/tab selection: provider별 candidate tab을 수집하고 exact configured URL을 우선 선택한다. selected URL/title/target id/candidate count를 extraction/state/status-json/health/debug에 남긴다.
- Debug commands: `npm run verify:usage-source`를 추가했다. CDP browser/version, selected tab, safe percentage context, selected candidates, parser output, status-json 비교를 출력한다.
- State freshness: `lastAttemptedAt`, `lastSuccessfulCheckedAt`, `lastParseFailedAt`, `stale`, `source`를 추가했다. 실패는 이전 값을 보존하지만 fresh timestamp로 갱신하지 않는다.
- Parser/normalization: selected candidate context를 parser output에 포함했다. Codex는 remaining, Claude는 used -> remaining 변환을 유지했다.
- Menu bar: Swift model이 stale/freshness 필드를 decode하고, 실패나 stale 상태는 `확인 필요`로 표시한다.
- Discord: stale/failure provider는 usage line에서 제외한다.
- Tests: source selection, screenshot fixtures, failed parse freshness, stale Discord omission, missing usage not 100을 scenario에 추가했다.

5. User screenshot comparison
- Codex expected 85/51: 최종 live CDP 값은 85/51이 아니라 더 낮은 58/47까지 감소했다. 하지만 reload 전 99/69 stale 값에서 벗어나 live source를 읽는 것은 확인됐다.
- Claude expected 50 used / 7 used: live CDP extraction과 status-json이 50 used / 7 used, remaining 50/93으로 일치했다.
- Match result: Claude는 screenshot 값과 일치. Codex는 사용량이 계속 감소해 screenshot 값 자체와는 불일치하지만 stale 99/69 문제는 재현 및 수정됐다.
- If not matched, why: Codex page가 verification 중 계속 사용되어 remaining이 85/51 이후로 감소했다. 같은 CDP target reload와 status-json 갱신이 감소를 따라갔다.

6. Commands run
- `npm run status:json`
- `npm run debug:codex`
- `npm run debug:claude`
- `npm run verify:usage-source`
- `npm run monitor -- --dry-run-notifications`
- `npm run monitor`
- `npm run health`
- `npm run test:scenarios`
- `npm run test:state`
- `npm run test:discord`
- `swift test --package-path macos/Mongi`
- `npm run build:app`
- `npm run package:app`
- `./scripts/compile-and-run-mongi.sh`
- `node -c src/extractors/usageExtractor.js && node -c src/parsers/common.js && node -c src/parsers/codexParser.js && node -c src/parsers/claudeParser.js && node -c src/state/stateStore.js && node -c src/state/serviceStateUpdater.js && node -c src/monitor.js && node -c scripts/status-json.js && node -c scripts/debug-page-text.js && node -c scripts/verify-usage-source.js && node -c scripts/health-check.js && node -c scripts/test-scenarios.js && node -c src/notifications/messages.js`
- `bash -n scripts/compile-and-run-mongi.sh && bash -n scripts/package-mongi-app.sh && bash -n scripts/start-cdp-chrome.sh`

7. Output / log summary
- 최초 status-json: Codex 99/69, Claude 100/100으로 stale 값이었다.
- 최초 verify:usage-source: selected source를 reload하자 Codex 73/49, Claude used 50/7이 추출됐고 status-json과 불일치가 드러났다.
- dry-run monitor: reload된 source를 state에 반영했고 Discord notificationsSent 0이었다.
- real monitor: Codex 64/48, Claude 50/93 remaining으로 state를 갱신했고 notificationsSent 0이었다.
- 최신 status-json after app refresh: Codex 58/47 remaining, Claude 50/93 remaining, both stale false.
- health: CDP reachable yes, launchd loaded yes, provider별 selected source URL/title/target id 표시.
- test:scenarios: 28개 scenario 통과.
- test:state: 통과.
- swift test: 9 tests, 0 failures.
- build/package/compile: Release/Debug Mongi.app 생성 및 open 성공.
- test:discord: Discord smoke message 전송 성공.

8. Failed / Not verified
- Codex screenshot의 85/51은 현재 live page에서 재현되지 않았다. 사용량이 계속 감소해 최신 live 값은 58/47이다.
- 실제 menu bar popover screenshot 클릭 검증은 수행하지 않았다. 대신 status-json, Swift decode/test, app build/open 경로를 검증했다.
- `npm run verify:usage-source`는 state를 쓰지 않는 진단 명령이므로, Codex가 활발히 감소하는 동안에는 extraction과 직전 status-json이 1% 차이날 수 있다. monitor/app refresh가 state를 갱신한다.

9. Report file
- v2/reports/phase-v2-06d_REPORT.md

10. V2 readiness judgment
- Ready
- Reason: live source target이 증명되고, existing provider tab reload로 stale DOM을 제거했으며, 실패 freshness/state/UI/Discord 처리가 분리됐다. Claude는 screenshot 값과 일치했고, Codex는 screenshot 이후 실제 사용으로 값이 더 낮아졌지만 stale 99/69 문제는 해결됐다.

11. Next recommended phase
- Phase-v2-07 — Post-V2 polish backlog
