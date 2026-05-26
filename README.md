# Mongi Usage Coach

## 목차

- 소개
- 현재 상태
- 설치
- 환경변수 설정
- Discord Webhook 설정
- Daily workflow
- Starting Mongi locally
- Automatic monitor with launchd
- Health check
- Log summary
- Local verification
- Troubleshooting
- Usage 추출 디버그
- Persistent fallback
- Remaining percent
- 이벤트 알림
- 테스트 명령
- 보안 주의
- 다음 단계

## 소개

Mongi Usage Coach는 Codex와 Claude 유료 사용량이 방치되지 않도록 Discord로 작은 행동 알림을 보내는 개인용 usage coach다.

## 현재 상태

Phase-a-03은 일반 Chrome CDP로 usage page를 읽고, remaining percent 기준 이벤트를 감지해 Discord로 몽이 알림을 보내는 단계다.

- 환경변수 로딩
- 파일 기반 state 저장
- Discord Webhook 테스트 전송
- 몽이 메시지 scaffold
- 일반 Chrome CDP 연결
- Playwright persistent browser profile fallback
- Codex/Claude usage page 텍스트 추출
- 서비스별 parser scaffold
- Codex/Claude percent 의미 정규화
- 이벤트 감지와 중복 방지
- quiet hours
- scenario test
- 실패 진단 파일 저장

Phase-b-03은 one-click Chrome CDP starter, launchd monitor automation, health/log summary를 조합한 로컬 운영 단계다.

## 설치

```bash
npm install
npx playwright install chromium
```

Node.js 18 이상이 필요하다.

## 환경변수 설정

```bash
cp .env.example .env
```

`.env`에는 실제 값을 넣고, `.env.example`에는 placeholder만 유지한다.

로컬 MVP 기본값은 CDP 모드다.

```bash
BROWSER_CONNECTION_MODE=cdp
CHROME_CDP_URL=http://127.0.0.1:9222
CHROME_USER_DATA_DIR=$HOME/.mongi-chrome-profile
```

## Discord Webhook 설정

Discord 채널 설정에서 Webhook을 만든 뒤 `.env`의 `DISCORD_WEBHOOK_URL`에 넣는다.

Webhook URL은 코드, README, 로그, Git에 남기지 않는다.

## Daily workflow

1. Mac을 켠다.
2. `Mongi Start.command`를 더블클릭하거나 `npm run start:chrome`을 실행한다.
3. Codex/Claude usage page가 보이는지 확인한다.
4. 로그인이나 Turnstile이 보이면 직접 통과한다.
5. 상태가 애매하면 `npm run health`를 실행한다.
6. launchd가 10분마다 monitor를 실행하게 둔다.

## Starting Mongi locally

Mongi는 일반 Chrome을 CDP 모드로 열고, 그 Chrome에 로그인된 Codex/Claude usage page를 읽는다.

터미널에서 시작:

```bash
npm run start:chrome
```

상태 확인:

```bash
npm run check:cdp
```

Finder에서 더블클릭으로 시작:

```text
Mongi Start.command
```

`start:chrome`은 기본적으로 다음을 한다.

- Chrome CDP가 이미 켜져 있으면 새 Chrome을 또 열지 않는다.
- CDP가 꺼져 있으면 `$HOME/.mongi-chrome-profile` profile로 Chrome을 연다.
- Codex/Claude usage page를 연다.
- CDP 연결 가능 여부를 확인한다.

열린 Chrome에서 Codex/ChatGPT와 Claude에 직접 로그인한다.

확인할 페이지:

- Codex: `https://chatgpt.com/codex/cloud/settings/analytics#usage`
- Claude: `https://claude.ai/settings/usage`

두 usage page가 Chrome에서 보이는 상태로 둔 뒤 monitor를 실행한다.

```bash
npm run monitor
```

기존 수동 명령이 필요하면 다음으로 확인할 수 있다.

```bash
npm run chrome:command
```

Troubleshooting:

- Chrome not found: `CHROME_PATH`로 Chrome 실행 파일 경로를 지정한다.
- CDP not reachable: `npm run start:chrome` 실행 후 `npm run check:cdp`를 다시 실행한다.
- port 9222 already in use: 기존 프로세스가 9222를 쓰고 있는지 확인하거나 `CHROME_CDP_PORT`와 `CHROME_CDP_URL`을 함께 바꾼다.
- usage page asks for login: CDP Chrome 창에서 직접 로그인한다.
- Cloudflare/Turnstile appears: 자동 우회하지 않는다. Chrome에서 직접 통과한 뒤 다시 `npm run monitor`를 실행한다.
- profile reset: `$HOME/.mongi-chrome-profile`을 삭제하면 CDP Chrome profile을 초기화할 수 있다. 이 작업은 로그인 세션도 지운다.

Security:

- CDP는 `127.0.0.1`에만 둔다.
- 9222 포트를 외부 네트워크에 노출하지 않는다.
- browser profile을 커밋하지 않는다.

## Automatic monitor with launchd

launchd는 10분마다 monitor만 실행한다. Chrome은 자동으로 시작하지 않는다.

기본 흐름:

1. `Mongi Start.command` 또는 `npm run start:chrome`으로 CDP Chrome을 연다.
2. Codex/Claude usage page에서 로그인 상태를 확인한다.
3. launchd가 `npm run monitor`를 주기 실행한다.

설치:

```bash
npm run launchd:install
```

상태 확인:

```bash
npm run launchd:status
```

로그 확인:

```bash
npm run launchd:logs
```

해제:

```bash
npm run launchd:uninstall
```

한 번만 wrapper로 monitor를 실행:

```bash
npm run monitor:run
```

주의:

- Mac이 켜져 있고 사용자 세션이 로그인된 상태여야 한다.
- CDP Chrome이 열려 있어야 usage page를 정상으로 읽을 수 있다.
- CDP Chrome이 꺼져 있으면 monitor는 실패 진단을 남기고, 기존 rate-limit 정책에 따라 Discord diagnostic만 보낼 수 있다.
- quiet hours에는 정상 이벤트 알림이 suppress될 수 있다.

Troubleshooting:

- node/npm not found under launchd: `scripts/run-monitor.sh`의 PATH에 Node 설치 경로가 포함되어 있는지 확인한다.
- permission denied: `chmod +x scripts/run-monitor.sh scripts/install-launchd.sh scripts/uninstall-launchd.sh scripts/check-launchd-status.sh`를 실행한다.
- plist not loading: `npm run launchd:status`로 plist path와 loaded 상태를 확인한다.
- logs empty: `npm run launchd:install` 후 RunAtLoad가 실행됐는지 확인하고, Mac이 잠자기 상태가 아니었는지 확인한다.
- CDP unreachable: `npm run start:chrome`으로 CDP Chrome을 먼저 연 뒤 `npm run check:cdp`를 실행한다.
- Discord not receiving messages: `.env`의 Webhook 설정, quiet hours, 이벤트 중복 방지 상태를 확인한다.
- quiet hours suppressing notifications: 기본 23:00-08:00에는 알림이 가지 않고 state와 logs만 갱신된다.

## Health check

```bash
npm run health
```

확인할 수 있는 것:

- `.env` 존재 여부
- Discord Webhook 설정 여부
- CDP Chrome reachable 여부
- launchd plist와 loaded 상태
- 마지막 wrapper 시작/종료 시각
- Codex/Claude remaining percent와 parse failure count
- quiet hours 적용 여부
- launchd log size warning

## Log summary

```bash
npm run logs:summary
```

긴 launchd 로그 대신 최근 실행만 요약한다.

- 마지막 wrapper start/finish
- 마지막 exit code
- 마지막 monitor completed 여부
- 서비스별 parse 결과
- events
- notifications sent
- 최근 error/warn line

## Local verification

```bash
npm run verify:local
```

이 명령은 다음을 한 번씩 실행한다.

- `npm run check:cdp`
- `npm run test:state`
- `npm run test:scenarios`
- `npm run monitor`
- `npm run health`
- `npm run logs:summary`
- `.env`에 Webhook이 있으면 `npm run test:discord`

현재 state에 따라 정상 Discord notification이 발생할 수 있다. 이벤트를 강제로 만들지는 않는다.

## Troubleshooting

- no Discord notification: 이벤트가 없거나 중복 방지에 걸렸거나 quiet hours일 수 있다. `npm run health`에서 quiet hours와 recent notifications를 확인한다.
- quiet hours: 기본 23:00-08:00에는 알림이 suppress되고 state/logs만 갱신된다.
- CDP unreachable: `npm run start:chrome` 또는 `Mongi Start.command`로 CDP Chrome을 연다.
- launchd not loaded: `npm run launchd:install` 후 `npm run launchd:status`를 확인한다.
- monitor succeeds but no event: usage percent 변화가 없으면 보낼 알림이 없을 수 있다.
- login expired: CDP Chrome에서 Codex/Claude usage page를 열고 다시 로그인한다.
- Turnstile appears: 자동 우회하지 않는다. Chrome에서 직접 통과한 뒤 `npm run monitor`를 실행한다.
- logs too large: `npm run health`가 5MB 이상 log warning을 보여준다. 내용을 확인한 뒤 필요하면 수동으로 비운다.
- state missing/corrupt: `npm run test:state` 또는 `npm run monitor`를 실행한다. corrupt state는 백업 후 새 state로 재생성된다.

## Usage 추출 디버그

```bash
npm run debug:page-text
```

한 서비스만 확인할 수도 있다.

```bash
npm run debug:page-text -- codex
npm run debug:page-text -- claude
```

diagnostic 파일은 `logs/`에 저장된다.

```bash
logs/debug-codex-text.txt
logs/debug-claude-text.txt
logs/debug-codex-summary.json
logs/debug-claude-summary.json
```

파싱이 실패하면 먼저 일반 Chrome에서 usage page가 실제로 보이는지 확인한다. Turnstile/Cloudflare 확인 화면이면 Chrome에서 직접 통과한 뒤 다시 실행한다.

## Persistent fallback

CDP가 어렵거나 별도 Playwright profile을 쓰고 싶을 때만 사용한다.

```bash
npm run login
```

브라우저가 열리면 Codex와 Claude에 직접 로그인한다. 로그인 세션은 `browser-profile/`에 저장된다.

한 서비스만 열 수도 있다.

```bash
npm run login -- codex
npm run login -- claude
```

fallback 사용 시 `.env`에서 `BROWSER_CONNECTION_MODE=persistent`로 바꾼다. headless 모드에서만 실패하면 `HEADLESS=false`로 바꾸고 다시 실행한다.

## Remaining percent

모든 이벤트 판단은 canonical remaining percent 기준이다.

- `remaining 100`: 완전히 사용 가능
- `remaining 0`: 사용 가능량 없음
- 사용하면 remaining이 감소
- 회복되면 remaining이 증가

Codex와 Claude는 화면 percent 의미가 다를 수 있다.

- Codex: `66%`가 remaining capacity로 읽히면 remaining `66`
- Claude: `0% used` 또는 `0% 사용됨`이면 raw used `0`, remaining `100`

이벤트 감지는 `raw` 값이 아니라 `remainingShortWindowPercent`, `remainingWeeklyPercent`만 사용한다.

## 이벤트 알림

Discord로 보낼 수 있는 이벤트:

- `recovered_short`: 단기 한도 100% 회복
- `recovered_weekly`: 주간 한도 100% 회복
- `session_stopped`: 사용 후 idle threshold 이상 변화 없음
- `weekly_idle`: 주간 remaining 100%가 오래 유지됨
- `parse_failure_digest`: 파싱 실패 반복
- `cdp_unreachable_digest`: Chrome CDP 연결 실패 반복

`usage_active`는 내부 이벤트다. 사용 중에는 Discord 알림을 보내지 않고 `sessionSummarySent`만 reset한다.

기본 quiet hours는 23:00-08:00이다. 이 시간에는 알림을 보내지 않지만 state와 logs는 계속 갱신한다.

weekly idle은 “아껴둔 한도”가 아니라 “아직 산출물로 바꾸지 못한 결제분”을 알려주는 리마인드다.

## 테스트 명령

```bash
npm run test:state
```

state 파일을 만들고 다시 읽어 smoke timestamp가 저장되는지 확인한다.

```bash
npm run test:discord
```

Discord Webhook URL이 있으면 테스트 메시지를 보낸다. URL이 없으면 명확한 missing env 에러로 실패한다.

```bash
npm run test:scenarios
```

실제 Discord를 보내지 않고 normalization, event detection, duplicate prevention, quiet hours를 검증한다.

```bash
npm run monitor
```

Codex와 Claude usage page 접근을 각각 시도하고, parser 결과를 state에 반영한 뒤 필요한 이벤트만 Discord로 보낸다. 한 서비스 실패나 Discord 실패가 전체 state 저장을 막지 않는다.

## 보안 주의

- `.env`는 커밋하지 않는다.
- `data/state.json`은 런타임 파일이라 커밋하지 않는다.
- `logs/`와 `browser-profile/`은 커밋하지 않는다.
- Discord Webhook URL은 환경변수에서만 읽는다.
- diagnostic text에는 페이지 텍스트가 들어갈 수 있으므로 공유하지 않는다.

## 다음 단계

Phase-c에서는 실제 사용 검증과 알림 정책 튜닝을 진행한다.
