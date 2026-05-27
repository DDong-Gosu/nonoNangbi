Phase-v2-06c Report

1. Files created/changed
- README.md
- macos/Mongi/Mongi/Views/MenuBarStatusView.swift
- macos/Mongi/MongiCore/StatusDisplayFormatter.swift
- macos/Mongi/MongiCoreTests/StatusDisplayFormatterTests.swift
- scripts/test-scenarios.js
- src/parsers/codexParser.js
- src/parsers/claudeParser.js
- src/parsers/common.js
- v2/reports/phase-v2-06c_REPORT.md

2. QA issues reviewed
- Menu bar gauge visibility: menu bar popover was rebuilt with an always-visible provider block that shows CodexBar-style compact gauges. Two horizontal bars per provider (Codex 5시간/주간, Claude 세션/전체) display remaining% with a colored fill and an optional reset countdown. The popover no longer hides usage in a scroll view behind action buttons.
- Usage accuracy: source-level audit walked browser text → parser → state → status-json → Swift decode → menu bar → Discord. Codex remaining/used mapping continues to match live provider (99/69 remaining, 1/31 used). Claude live page currently exposes 0% 사용됨, which the parser converts to 100/100 remaining and 0/0 used. Mapping is now resilient against unrelated percents such as "최대 30% 할인".
- Missing value handling: parsers no longer fall back to "any percent on the page". When no labeled candidate is found, the parser returns ok=false with rawShortWindowMeaning="unknown" and remaining/used = null. State updater preserves the previous good values and bumps consecutiveParseFailures. UI shows "확인 안 됨" with an empty neutral gauge; Discord omits the provider from the usage line.
- Discord consistency: Discord usage line still uses the same normalized remaining values that status-json/menu bar consume. When a provider's remaining values are null, the line is dropped from the message instead of becoming "100/100 남음".

3. Source-level usage audit
- Codex: live "99% 남음 / 69% 남음" → parser score-based pickBestPercent finds short/weekly with "remaining" meaning → updater writes remainingShortWindowPercent=99, remainingWeeklyPercent=69, usedShortWindowPercent=1, usedWeeklyPercent=31.
- Claude: live "0% 사용됨" twice → parser detects two "used" candidates (current session / all-models) → remaining derived as 100/100, used 0/0. Anti-keyword rejects "30% 할인" so it no longer leaks into shortWindowPercent.
- Parser: src/parsers/codexParser.js and src/parsers/claudeParser.js now share the new common.scoreCandidate behavior. fallbackCandidate logic was removed; both parsers return null+ok:false when no keyword-matched candidate exists.
- State: src/state/serviceStateUpdater.js was untouched. It already preserves last-known values when parseResult.ok is false, and only overwrites when concrete percent fields are non-null. lastCheckedAt is still updated so the UI freshness clock works.
- status-json: scripts/status-json.js still reads remaining/used/meaning/label/lastCheckedAt/failures for each service. With ok=false the status reports unchanged remaining values plus consecutiveParseFailures > 0 for the provider, surfaced via the new "N회 파싱 실패" badge in the menu bar.
- Swift model: MongiStatus.ServiceUsage already decodes the full surface area. No model change required.
- Menu bar: MenuBarStatusView was rebuilt around a provider usage block above the action list. CompactGaugeRow shows `5시간 99% 남음` plus a horizontal gauge; missing values switch the color to secondary and skip the filled bar. Health (CDP/launchd) and refresh metadata moved into a single meta row, reducing total popover height.
- Discord: src/notifications/messages.js' servicePercent/normalizeUsage/formatUsageLine path is unchanged. With the new null-safe parser, a provider with null remaining now drops from the line; tests pin the behavior.

4. Fixes applied
- Menu bar: MenuBarStatusView fully redesigned. Provider gauges are no longer in a ScrollView. New CompactGaugeRow + GaugeBar render remaining% with color (green ≥50, orange ≥20, red <20) and reset countdown when available. Provider header shows "N회 파싱 실패" or "확인 HH:mm".
- Parser/normalization: src/parsers/common.js added ANTI_KEYWORDS list and hasAntiKeyword helper; scoreCandidate now short-circuits to 0 for any candidate near 할인/쿠폰/프로모션/discount/promo/coupon/sale/광고/savings. Both src/parsers/codexParser.js and src/parsers/claudeParser.js removed the "use percentCandidates[0] when no keyword matched" fallback that previously caused unrelated percents to leak into rawShortWindowPercent.
- status-json: no source change. With the parser fix, status-json output no longer surfaces phantom remaining values when the page only contains promo percents.
- Swift/UI: StatusDisplayFormatter gained shortGaugeTitle and weeklyGaugeTitle ("5시간/주간" for Codex, "세션/전체" for Claude). Existing usageSummary, percentText, progress, resetCountdown unchanged. UsageCardView (full app) still reuses UsageMeterView and stays consistent.
- Discord: formatUsageLine already drops a provider with null values; new scenario test ensures this path stays correct so a missing Claude usage cannot become a silent "100/100 남음" Discord message.
- Tests: scripts/test-scenarios.js added three new scenarios — "Claude promo/discount percent does not become usage", "Codex coupon/discount percent does not become usage", "Missing Claude usage stays unavailable, not 100". StatusDisplayFormatterTests gained testGaugeTitles.

5. Usage verification
- Codex: npm run debug:codex (live CDP) → remainingShortWindowPercent=99, remainingWeeklyPercent=69, usedShortWindowPercent=1, usedWeeklyPercent=31, parseConfidence=high. status-json shows the same values; menu bar gauges render 99%/69% with green fill.
- Claude: npm run debug:claude (live CDP) → remainingShortWindowPercent=100, remainingWeeklyPercent=100, usedShortWindowPercent=0, usedWeeklyPercent=0, parseConfidence=high. The "30% 할인" promo line is present in extracted text but is now rejected by the anti-keyword guard. Status-json reports 100/100 remaining, matching the current live page snippet (0% used). The user's earlier 4% used screenshot was taken at a different moment; live extraction at the time of this run shows 0% used.
- Missing/unknown behavior: synthetic scenarios with only promo or unrelated text verify that remaining/used stay null, ok=false, and the Discord usage line is omitted. State updater retains the previous good values.
- Remaining limitation: visual popover screenshot was not captured (no Computer Use access in this run). Manual verification step: open Mongi.app → click menu bar icon → the provider gauges should appear directly under the status banner, with two horizontal bars per provider. The dist Debug build and the Release build both completed; the menu bar app was reopened.

6. Commands run
- node -c src/parsers/common.js && node -c src/parsers/codexParser.js && node -c src/parsers/claudeParser.js && node -c src/notifications/messages.js && node -c scripts/test-scenarios.js && node -c scripts/status-json.js
- npm run test:scenarios
- npm run test:state
- swift test --package-path macos/Mongi
- npm run debug:codex
- npm run debug:claude
- npm run monitor -- --dry-run-notifications
- npm run status:json
- npm run health
- npm run build:app
- npm run compile:app
- npm run package:app

7. Output / log summary
- test:scenarios passed 26 scenarios including the three new anti-keyword / missing-value cases.
- test:state passed; state smoke test wrote lastStateSmokeTestAt successfully.
- swift test executed 9 tests, 0 failures (StatusDisplayFormatterTests, RefreshCadenceTests).
- debug:codex: parseConfidence=high, short remaining 99, weekly remaining 69.
- debug:claude: parseConfidence=high, short used 0, weekly used 0 (remaining 100/100). Anti-keyword excluded "30% 할인".
- monitor --dry-run-notifications: events=[], notificationsSent=0, parsers ok, Codex 99/69 remaining, Claude 100/100 remaining.
- status:json: overallStatus=warning only because quiet hours are active. usage block matches monitor output; failures=0 for both providers.
- health: Codex 99/69 / Claude 100/100 / quiet hours active / launchd loaded / CDP reachable.
- build:app, compile:app, package:app: all produced ad-hoc signed Mongi.app in dist/Debug or dist/Release.

8. Failed / Not verified
- Popover screenshot inspection was not performed (no Computer Use access). Code, swift tests, app build, and live status refresh were verified.
- The user's screenshot of Claude `4% 사용됨` was not reproducible at the time of this run because the live CDP page currently shows `0% 사용됨`. Coverage for the 4% case stays in the fixture in scripts/test-scenarios.js (Claude observed mismatch fixture).
- `macos/Mongi/.swiftpm/xcode/package.xcworkspace/xcuserdata/shadowmoon.xcuserdatad/UserInterfaceState.xcuserstate` was already touched by the IDE before this phase and was not modified intentionally.

9. Report file
- v2/reports/phase-v2-06c_REPORT.md

10. V2 readiness judgment
- Ready / Not ready: Ready
- Reason: Menu bar popover now exposes Codex and Claude usage as CodexBar-style compact gauges directly under the status banner, with explicit "확인 안 됨" for missing values. Parser anti-keyword + fallback removal closes the silent 100% (and silent random-percent) hole. Live CDP run still produces Codex 99/69 remaining and Claude 100/100 remaining that match the current provider pages. status-json, monitor, swift tests, and the Discord formatter all share the same normalized values. The remaining gap is purely visual screenshot capture, not data correctness.

11. Next recommended phase
- Phase-v2-07 — Post-V2 polish backlog
