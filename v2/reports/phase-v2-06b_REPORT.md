Phase-v2-06b Report

1. Files created/changed
- README.md
- macos/Mongi/Mongi/ContentView.swift
- macos/Mongi/Mongi/Models/CommandState.swift
- macos/Mongi/Mongi/Models/MongiStatus.swift
- macos/Mongi/Mongi/MongiAppViewModel.swift
- macos/Mongi/Mongi/Views/ActionsView.swift
- macos/Mongi/Mongi/Views/MenuBarStatusView.swift
- macos/Mongi/Mongi/Views/NextActionView.swift
- macos/Mongi/Mongi/Views/StatusOverviewView.swift
- macos/Mongi/Mongi/Views/UsageCardView.swift
- macos/Mongi/MongiCore/RefreshCadence.swift
- macos/Mongi/MongiCore/StatusDisplayFormatter.swift
- macos/Mongi/MongiCoreTests/StatusDisplayFormatterTests.swift
- scripts/start-cdp-chrome.sh
- scripts/status-json.js
- scripts/test-scenarios.js
- src/notifications/messages.js
- src/output/gitOutputStatus.js
- v2/reports/phase-v2-06b_REPORT.md

2. QA issues reviewed
- Menu bar usage visibility: 기존 popover에서 usage가 action 아래로 밀리거나 보이지 않는 문제가 있었고, header에 Codex/Claude 남은 사용량 요약을 항상 표시하도록 고쳤습니다.
- Korean status labels: 내부 enum은 유지하고 `SHIPPED -> 오늘 푸시함`, `LOCAL_ONLY -> 로컬 작업만 있음`, `NO_OUTPUT -> 산출물 없음` 표시 mapping을 추가했습니다.
- Discord readability: raw enum, `S/W`, `Usage remaining` 문구를 제거하고 한국어 우선 3줄 메시지로 바꿨습니다.
- Usage tracking accuracy: Codex live 99/69 remaining은 parser, state, status-json에서 일치했습니다. Claude live CDP text는 현재 0/0 used로 추출되어 status-json 100/100 remaining과 일치했습니다.
- Notification spam: app refresh와 monitor dry-run은 Discord를 보내지 않았고, CDP Chrome이 이미 reachable일 때 `start:chrome`이 start notification을 반복 발송하지 않도록 막았습니다.

3. Fixes applied
- Menu bar: header에 `Codex 남음 99% / 69%`, `Claude 남음 100% / 100%`, 마지막 새로고침, 주기를 표시하도록 추가했습니다. 버튼과 주요 label도 한국어로 바꿨습니다.
- Full app: usage card label을 Codex는 `5시간/주간`, Claude는 `세션/전체` 기준으로 표시하고 used/reset/checked label을 한국어로 정리했습니다.
- Discord: output status message를 `몽이 · 로컬 작업만 있음 / 아직 푸시 안 됨. 오늘 하나 올리자. / Codex 99/69 · Claude 33/96 남음` 형식으로 변경했습니다. start message는 `몽이 · Mongi 시작 / 10분마다 조용히 확인 / 알림은 필요한 경우만 전송` 형식입니다.
- Usage parser/normalization: 기존 Phase-v2-06 parser mapping은 유지했고, status-json output에 `displayLabel`과 `displayMeaning`을 추가해 UI 표시 mapping을 명확히 했습니다.
- Refresh/no-spam: `start-cdp-chrome.sh`에서 CDP가 이미 reachable이면 Discord start notification을 보내지 않게 했습니다. app refresh는 기존처럼 `monitor -- --dry-run-notifications` 후 `status:json`을 읽습니다.

4. Usage verification
- Codex: `npm run debug:codex`에서 `remainingShortWindowPercent=99`, `remainingWeeklyPercent=69`, `usedShortWindowPercent=1`, `usedWeeklyPercent=31`, confidence high를 확인했습니다.
- Claude: `npm run debug:claude`에서 현재 CDP page snippet이 `0% 사용됨`으로 추출됐고 parser/status-json은 used 0/0, remaining 100/100으로 일치했습니다. 사용자 스크린샷의 4% used 상태는 현재 live CDP page에서 재현되지 않았습니다.
- status-json: output은 internal `LOCAL_ONLY`와 display `로컬 작업만 있음`을 함께 노출했습니다. usage는 Codex 99/69 remaining, Claude 100/100 remaining, used 값과 meaning/label을 보존했습니다.
- Swift/UI: Swift model은 display fields와 used/remaining fields를 decode하도록 확장됐고, Swift build/test 및 app open 후 quiet refresh가 통과했습니다.
- Remaining limitation: Computer Use 접근이 Apple event error -1743으로 실패해 popover를 실제 클릭한 스크린샷 검증은 못 했습니다. reset timestamp는 여전히 null이라 reset countdown은 `확인 안 됨`으로 표시됩니다.

5. Tests / assertions
- JS syntax checks passed for changed JS files.
- `npm run test:scenarios` passed, including Korean status display mapping, Korean-first Discord messages, Codex 99/69 fixture, Claude used-to-remaining fixture, output status scenarios, quiet-hours suppression.
- `npm run test:state` passed.
- `swift test --package-path macos/Mongi` passed: 8 tests, 0 failures.
- Discord formatter sample output was inspected and stayed within 3 logical lines.
- `npm run test:discord` sent the updated test message successfully without printing secrets.

6. Commands run
- `node -c src/output/gitOutputStatus.js && node -c src/notifications/messages.js && node -c scripts/status-json.js && node -c scripts/test-scenarios.js && node -c scripts/notify-start.js`
- `npm run test:scenarios`
- `npm run test:state`
- `swift test --package-path macos/Mongi`
- `npm run status:json`
- `npm run debug:codex`
- `npm run debug:claude`
- `npm run monitor -- --dry-run-notifications`
- `npm run monitor`
- `npm run health`
- `npm run test:discord`
- `npm run build:app`
- `npm run package:app`
- `./scripts/compile-and-run-mongi.sh`
- `bash -n scripts/compile-and-run-mongi.sh && bash -n scripts/package-mongi-app.sh && bash -n scripts/start-cdp-chrome.sh`
- Discord formatter sample command with `node`

7. Output / log summary
- status-json: `overallStatus=warning` only because quiet hours are active. `output.outputStatus=LOCAL_ONLY`, `output.displayLabel=로컬 작업만 있음`.
- status-json usage: Codex remaining 99/69, used 1/31, meaning remaining. Claude remaining 100/100, used 0/0, meaning used.
- dry-run monitor: events `[]`, notificationsSent `0`, Codex 99/69, Claude 100/100.
- real monitor during quiet hours: events `[]`, notificationsSent `0`.
- app open after compile: `dist/Debug/Mongi.app` opened, then provider `lastCheckedAt` advanced to app refresh time while `today.notificationsSent` stayed 0.
- build/package: Release and Debug app bundles were created under `dist/`.

8. Failed / Not verified
- Claude 4% used from the user screenshot was not present in the current CDP extraction; current live text shows 0% used. The 4% and 67% used cases are covered by fixtures, not live-reproduced in this run.
- Popover visual screenshot inspection was blocked by Computer Use Apple event error -1743. Code, Swift tests, build, app open, and status refresh were verified.
- `macos/Mongi/.swiftpm/xcode/package.xcworkspace/xcuserdata/shadowmoon.xcuserdatad/UserInterfaceState.xcuserstate` was already modified before this phase and was not intentionally changed.

9. Report file
- v2/reports/phase-v2-06b_REPORT.md

10. V2 readiness judgment
- Ready / Not ready: Ready
- Reason: The blocker visible in the menu bar is fixed in code by moving usage into the always-visible header, Korean labels are now mapped for status-json/Swift/Discord, Discord messages are compact and readable, live Codex tracking matches the provider extraction, current live Claude extraction matches status-json semantics, refresh paths do not send Discord, and tests/build/package passed. The remaining uncertainty is visual screenshot verification and historical Claude screenshot reproduction, not the current live CDP pipeline.

11. Next recommended phase
- Phase-v2-07 — Post-V2 polish backlog
