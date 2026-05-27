Phase-v2-06 Report

1. Files created/changed
- README.md
- macos/Mongi/Mongi/Models/MongiStatus.swift
- macos/Mongi/Mongi/MongiAppViewModel.swift
- macos/Mongi/Mongi/Services/MongiStatusService.swift
- macos/Mongi/Mongi/Views/MenuBarStatusView.swift
- macos/Mongi/Mongi/Views/UsageCardView.swift
- scripts/debug-page-text.js
- scripts/health-check.js
- scripts/status-json.js
- scripts/summarize-launchd-logs.js
- scripts/test-scenarios.js
- src/monitor.js
- src/notifications/messages.js
- src/parsers/common.js
- src/parsers/codexParser.js
- src/parsers/claudeParser.js
- src/state/serviceStateUpdater.js
- src/state/stateStore.js
- v2/reports/phase-v2-06_REPORT.md

2. Previous phase review
- Phase-v2-03 refresh는 기존에 `status:json`만 읽는 quiet path라 Discord spam은 없었지만, provider usage extraction 자체는 갱신하지 못했다.
- Phase-v2-04 UI는 remaining bar 중심이었지만 `usedPercent`가 상태와 status-json에 보존되지 않아 Claude 의미를 inspect하기 어려웠다.
- Phase-v2-05 packaging scripts는 유지했고, 이번 변경 뒤에도 Release/Debug app bundle 생성과 실행을 다시 검증했다.

3. Usage tracking mismatch investigation
- Root cause: parser 후보 scoring이 같은 page/card 안의 여러 percentage를 provider window별로 충분히 분리하지 못했고, state/status-json/UI가 `used`와 `remaining`을 함께 보존하지 않아 Claude처럼 used 기반 page에서 의미를 확인하기 어려웠다. Menu app refresh도 `status:json`만 읽어 live usage 갱신과 분리되어 있었다.
- Fix applied: percent token별 `before/after/previous/next` context를 저장하고 proximity scoring을 강화했다. Codex는 5-hour/weekly remaining으로, Claude는 current session/all-models used로 provider-specific mapping을 명시했다. State, status-json, health/log summary, Swift model/UI에 `shortUsed`/`weeklyUsed`와 meaning/label을 노출했다. Menu app refresh는 `npm run monitor -- --dry-run-notifications` 후 `npm run status:json`을 읽도록 바꿔 usage는 갱신하되 Discord 전송은 분리했다.
- Codex result: observed fixture와 live CDP 모두 Codex short remaining 99, weekly remaining 69, derived used 1/31로 확인했다.
- Claude result: observed fixture는 current session 67 used -> remaining 33, all-models 4 used -> remaining 96으로 통과했다. 현재 live CDP Claude page는 percent token 0%/30%를 노출했고 parser는 current session/all-models used 0/0, remaining 100/100으로 저장했다.
- Remaining limitation: 사용자가 관찰한 Claude 67/4 live 상태는 이번 실행 시 같은 CDP page에서 재현되지 않았다. Reset time은 status field는 유지하지만 live parser에서 아직 concrete reset timestamp로 추출하지 못해 null로 표시된다.

4. End-to-end QA scenarios
- Output status: scenario tests로 NO_OUTPUT, LOCAL_ONLY, SHIPPED를 통과했고 현재 real repo는 LOCAL_ONLY로 분류됐다.
- Discord: V2 message tests는 3-line 제한과 outputStatus-first 포맷을 통과했다. `npm run verify:local` 중 실제 `test:discord`가 성공했고 webhook은 출력하지 않았다.
- Refresh: direct dry-run monitor, real monitor, app launch 후 quiet refresh를 확인했다. App refresh 후 provider `lastCheckedAt`이 갱신됐고 `today.notificationsSent`는 증가하지 않았다.
- Usage: Codex 99/69 mismatch는 live와 fixture에서 고쳐졌다. Claude 67/4 mismatch는 fixture로 보장했고 live CDP 현재값은 0/0 used였다. status-json과 Swift model field는 remaining/used를 모두 포함한다.
- Packaging: `npm run package:app`, `npm run build:app`, `./scripts/package-mongi-app.sh`, `./scripts/compile-and-run-mongi.sh`가 통과했고 app bundle을 열었다.
- Documentation: README에 V2 usage semantics, remaining 중심 UI, provider-specific mapping, refresh freshness 기준을 추가했다.

5. Tests / assertions
- `npm run test:scenarios` 통과: Codex observed mismatch fixture, Claude observed mismatch fixture, normalization, outputStatus, Discord suppression/regression 포함.
- `npm run test:state` 통과.
- `swift test --package-path macos/Mongi` 통과: 7 tests, 0 failures.
- Node syntax checks 통과: parser, state, monitor, status-json, debug, health/log summary, scenario, Discord message modules.
- `npm run status:json` 확인: Codex remaining 99/69, used 1/31; Claude remaining 100/100, used 0/0; outputStatus LOCAL_ONLY.

6. Commands run
- `node -c src/parsers/common.js && node -c src/parsers/codexParser.js && node -c src/parsers/claudeParser.js && node -c src/state/stateStore.js && node -c src/state/serviceStateUpdater.js && node -c src/monitor.js && node -c scripts/status-json.js && node -c scripts/test-scenarios.js && node -c scripts/debug-page-text.js && node -c src/notifications/messages.js`
- `npm run test:scenarios`
- `npm run test:state`
- `npm run status:json`
- `npm run monitor -- --dry-run-notifications`
- `npm run debug:claude`
- `npm run debug:codex`
- `npm run monitor`
- `npm run health`
- `npm run logs:summary`
- `bash -n scripts/compile-and-run-mongi.sh && bash -n scripts/package-mongi-app.sh`
- `npm run verify:local`
- `swift test --package-path macos/Mongi`
- `./scripts/package-mongi-app.sh`
- `./scripts/compile-and-run-mongi.sh`
- `npm run build:app`
- `npm run package:app`

7. Output / log summary
- Dry-run monitor: Codex remaining 99/69, used 1/31; Claude current live page used 0/0, remaining 100/100; notificationsSent 0.
- Real monitor: same usage values, events none, notificationsSent 0.
- App quiet refresh after launch: usage `lastCheckedAt` advanced to the app refresh time, while status-json `today.notificationsSent` did not increase.
- Health: CDP reachable yes, launchd loaded yes, outputStatus LOCAL_ONLY, Codex short/weekly remaining 99/69 and used 1/31, Claude remaining 100/100 and used 0/0.
- Logs summary: latest launchd exit code 0; recent historical CDP unreachable errors remain from earlier runs; no secrets printed.

8. Failed / Not verified
- The exact live Claude 67% used / 4% used page state from the user-observed screenshot was not present during execution; it is covered by fixture tests, not by live reproduction.
- Reset countdown parsing remains not verified because current status-json reset fields are null.
- Popover visual click inspection was not separately captured, but the app was packaged/opened and its quiet refresh path updated usage state without increasing notification count.

9. Report file
- v2/reports/phase-v2-06_REPORT.md

10. V2 readiness judgment
- Ready / Not ready: Ready
- Reason: Core V2 flow works, Codex live mismatch is fixed, Claude used/remaining semantics are explicit and fixture-covered, status-json and Swift UI model agree, app refresh updates usage through a no-notify monitor path, and packaging/tests pass. Remaining limitations are reset timestamp extraction and inability to live-reproduce the earlier Claude 67/4 state in the current CDP page.

11. Next recommended phase
- Phase-v2-07 — Post-V2 polish backlog
