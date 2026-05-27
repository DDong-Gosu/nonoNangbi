Phase-v2-02 Report

1. Files created/changed
- `src/notifications/messages.js`
- `src/notifications/notificationDispatcher.js`
- `src/monitor.js`
- `scripts/notify-start.js`
- `scripts/test-discord.js`
- `scripts/test-scenarios.js`
- `scripts/start-cdp-chrome.sh`
- `package.json`
- `README.md`
- `docs/phases/reports/phase-v2-02_REPORT.md`

2. Discord message model
- Discord 본문은 V2 `outputStatus`를 첫 줄에 표시합니다.
- 기존 usage event는 중복 방지와 발송 조건으로 유지하지만, 사용자에게 보이는 메시지는 `NO_OUTPUT`, `LOCAL_ONLY`, `SHIPPED` 기준으로 포맷합니다.
- 복잡한 `nextAction`, AI session 상태, warning level 문구는 Discord 본문 생성에 사용하지 않습니다.

3. Message templates implemented
- Start: `Mongi started` / `Watching Git output: {status}` / `Cadence: {minutes}분마다 확인`
- NO_OUTPUT: `NO_OUTPUT` / shipped 또는 local Git output이 없다는 짧은 설명 / 사용량 percent
- LOCAL_ONLY: `LOCAL_ONLY` / local work가 있으니 오늘 push까지 닫으라는 짧은 action / 사용량 percent
- SHIPPED: `SHIPPED` / 오늘 shipped evidence가 감지됐다는 짧은 설명 / 사용량 percent

4. Usage percentage handling
- Codex와 Claude percent가 있으면 `Usage: Codex S99%/W99%, Claude S100%/W100%`처럼 한 줄로 붙입니다.
- 한 provider의 값이 없어도 메시지 생성은 실패하지 않습니다.
- usage percent는 보조 정보이며 `outputStatus` 결정에는 사용하지 않습니다.

5. Quiet hours handling
- quiet hours는 기존 dispatcher에서 Discord 발송을 `quiet_hours`로 suppress합니다.
- quiet hours는 `outputStatus`를 바꾸지 않습니다.
- scenario test에서 quiet hours suppression과 core status 불변을 확인했습니다.

6. Start notification handling
- `npm run notify:start`를 추가했습니다.
- `npm run test:discord`는 V2 start-style Discord message를 전송합니다.
- `npm run start:chrome`의 CDP ready / already reachable 경로에서 best-effort start notification을 호출합니다.
- menu bar app은 기존처럼 `npm run start:chrome`을 호출하므로 command 경로는 연결됐지만, 실제 menu bar 버튼 클릭은 별도로 검증하지 않았습니다.

7. Tests / assertions
- `NO_OUTPUT`, `LOCAL_ONLY`, `SHIPPED`, Start message가 3줄 이하인지 확인했습니다.
- status가 메시지에 포함되는지 확인했습니다.
- usage percent가 정확히 포함되는지 확인했습니다.
- usage가 없어도 메시지가 생성되는지 확인했습니다.
- dry-run dispatcher가 V2 output status message를 사용하는지 확인했습니다.

8. Commands run
- `node -c src/notifications/messages.js && node -c src/notifications/notificationDispatcher.js && node -c src/monitor.js && node -c scripts/test-discord.js && node -c scripts/notify-start.js && node -c scripts/test-scenarios.js`
- `npm run test:scenarios`
- `npm run test:state`
- `npm run test:discord`
- `npm run monitor -- --dry-run-notifications`
- `npm run monitor`
- `npm run health`
- `npm run status:json > /tmp/mongi-status-v2-02.json && node -e ...`
- `npm run notify:start -- --best-effort`
- `npm run start:chrome`

9. Output / log summary
- syntax checks passed.
- scenario tests passed, including V2 Discord formatter assertions.
- state smoke test passed.
- `npm run test:discord` sent a Discord test message successfully.
- dry-run monitor completed with `outputStatus: LOCAL_ONLY`, Codex 99/99, Claude 100/100, events 0, notificationsSent 0.
- real monitor completed with the same output summary and no notifications.
- health reported CDP reachable, launchd loaded, output status `LOCAL_ONLY`.
- status JSON validation reported `overallStatus: ok`, `outputStatus: LOCAL_ONLY`, `quietHoursActive: false`.
- `npm run notify:start -- --best-effort` sent a start notification successfully.
- `npm run start:chrome` completed through the already-reachable CDP path.

10. Failed / Not verified
- Real Discord delivery for formatter-driven usage events was not triggered by monitor because no dispatchable event occurred during the run.
- The menu bar button itself was not clicked; the underlying `npm run start:chrome` command path was verified.
- New Chrome launch branch of `start:chrome` was not exercised because CDP Chrome was already reachable.
- Existing unrelated worktree changes remain present, including deleted `phase/...` files and untracked `.claude/`, `v1/`, and `v2/`.

11. Report file
- docs/phases/reports/phase-v2-02_REPORT.md

12. Next recommended phase
- Phase-v2-03 — Menu Bar Refresh & Cadence
