# Mongi Usage Coach

## 목차

- 소개
- 현재 상태
- 설치
- 환경변수 설정
- Discord Webhook 설정
- Playwright 로그인
- Usage 추출 디버그
- 테스트 명령
- 보안 주의
- 다음 단계

## 소개

Mongi Usage Coach는 Codex와 Claude 유료 사용량이 방치되지 않도록 Discord로 작은 행동 알림을 보내는 개인용 usage coach다.

## 현재 상태

Phase-a-02는 Playwright 로그인 세션과 usage page 추출 기반 단계다.

- 환경변수 로딩
- 파일 기반 state 저장
- Discord Webhook 테스트 전송
- 몽이 메시지 scaffold
- Playwright persistent browser profile
- Codex/Claude usage page 텍스트 추출
- 서비스별 parser scaffold
- 실패 진단 파일 저장

아직 회복 알림, 세션 종료 알림, weekly idle 알림은 구현하지 않았다. 이벤트 Discord 알림은 Phase-a-03에서 추가한다.

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

## Discord Webhook 설정

Discord 채널 설정에서 Webhook을 만든 뒤 `.env`의 `DISCORD_WEBHOOK_URL`에 넣는다.

Webhook URL은 코드, README, 로그, Git에 남기지 않는다.

## Playwright 로그인

```bash
npm run login
```

브라우저가 열리면 Codex와 Claude에 직접 로그인한다. 로그인 세션은 `browser-profile/`에 저장된다.

한 서비스만 열 수도 있다.

```bash
npm run login -- codex
npm run login -- claude
```

로그인이 끝나면 브라우저를 닫거나 터미널에서 `Ctrl+C`로 종료한다.

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

- `logs/debug-codex-text.txt`
- `logs/debug-claude-text.txt`
- `logs/debug-codex-summary.json`
- `logs/debug-claude-summary.json`

파싱이 실패하면 먼저 `npm run login`으로 세션을 다시 만든다. headless 모드에서만 실패하면 `.env`에서 `HEADLESS=false`로 바꾸고 다시 실행한다.

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
npm run monitor
```

Codex와 Claude usage page 접근을 각각 시도하고, parser 결과를 state에 반영한다. 한 서비스가 실패해도 다른 서비스는 계속 실행된다.

## 보안 주의

- `.env`는 커밋하지 않는다.
- `data/state.json`은 런타임 파일이라 커밋하지 않는다.
- `logs/`와 `browser-profile/`은 커밋하지 않는다.
- Discord Webhook URL은 환경변수에서만 읽는다.
- diagnostic text에는 페이지 텍스트가 들어갈 수 있으므로 공유하지 않는다.

## 다음 단계

Phase-a-03에서는 event detection과 Mongi random notification system을 추가한다.
