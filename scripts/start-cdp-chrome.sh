#!/usr/bin/env bash
set -euo pipefail

load_dotenv_defaults() {
  if [[ ! -f ".env" ]] || ! command -v node >/dev/null 2>&1; then
    return
  fi

  while IFS= read -r line; do
    local key="${line%%=*}"
    local value="${line#*=}"

    case "$key" in
      CHROME_PATH|CHROME_CDP_PORT|CHROME_CDP_URL|CHROME_USER_DATA_DIR|CODEX_USAGE_URL|CLAUDE_USAGE_URL)
        if [[ -z "${!key:-}" ]]; then
          printf -v "$key" "%s" "$value"
          export "$key"
        fi
        ;;
    esac
  done < <(node <<'NODE'
try {
  const fs = require("fs");
  const dotenv = require("dotenv");
  const parsed = dotenv.parse(fs.readFileSync(".env"));
  const keys = [
    "CHROME_PATH",
    "CHROME_CDP_PORT",
    "CHROME_CDP_URL",
    "CHROME_USER_DATA_DIR",
    "CODEX_USAGE_URL",
    "CLAUDE_USAGE_URL"
  ];

  for (const key of keys) {
    if (Object.hasOwn(parsed, key)) {
      const value = String(parsed[key]).replace(/\r?\n/g, " ");
      process.stdout.write(`${key}=${value}\n`);
    }
  }
} catch {}
NODE
)
}

expand_home_path() {
  local value="$1"

  if [[ "$value" == '$HOME'/* ]]; then
    printf "%s/%s" "$HOME" "${value#\$HOME/}"
    return
  fi

  if [[ "$value" == "~/"* ]]; then
    printf "%s/%s" "$HOME" "${value#~/}"
    return
  fi

  printf "%s" "$value"
}

load_dotenv_defaults

DEFAULT_CHROME_CDP_PORT="9222"
CHROME_PATH="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
CHROME_CDP_PORT="${CHROME_CDP_PORT:-$DEFAULT_CHROME_CDP_PORT}"
CHROME_CDP_URL="${CHROME_CDP_URL:-http://127.0.0.1:${CHROME_CDP_PORT}}"
CHROME_USER_DATA_DIR="${CHROME_USER_DATA_DIR:-$HOME/.mongi-chrome-profile}"
CODEX_USAGE_URL="${CODEX_USAGE_URL:-https://chatgpt.com/codex/cloud/settings/analytics#usage}"
CLAUDE_USAGE_URL="${CLAUDE_USAGE_URL:-https://claude.ai/settings/usage}"
CHROME_USER_DATA_DIR="$(expand_home_path "$CHROME_USER_DATA_DIR")"

cdp_version_url="${CHROME_CDP_URL%/}/json/version"

cdp_reachable() {
  curl -fsS --max-time 2 "$cdp_version_url" >/dev/null 2>&1
}

wait_for_cdp() {
  local attempts=20

  for _ in $(seq 1 "$attempts"); do
    if cdp_reachable; then
      return 0
    fi

    sleep 0.5
  done

  return 1
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Mongi CDP Chrome starter is intended for macOS."
  echo "Current system: $(uname -s)"
fi

if cdp_reachable; then
  echo "Mongi CDP Chrome is already reachable."
  echo "CDP URL: $CHROME_CDP_URL"
  echo "중복 탭을 피하려고 usage page는 새로 열지 않았습니다."
  echo "다음 확인: npm run check:cdp"
  echo "사용량 읽기: npm run monitor"
  exit 0
fi

if [[ ! -x "$CHROME_PATH" ]]; then
  echo "Chrome not found or not executable."
  echo "Expected path: $CHROME_PATH"
  echo "Override example: CHROME_PATH=\"/path/to/Google Chrome\" npm run start:chrome"
  exit 1
fi

mkdir -p "$CHROME_USER_DATA_DIR"

echo "Starting Mongi CDP Chrome..."
echo "CDP URL: $CHROME_CDP_URL"
echo "Profile: $CHROME_USER_DATA_DIR"

"$CHROME_PATH" \
  --remote-debugging-port="$CHROME_CDP_PORT" \
  --user-data-dir="$CHROME_USER_DATA_DIR" \
  "$CODEX_USAGE_URL" \
  "$CLAUDE_USAGE_URL" \
  >/dev/null 2>&1 &

if ! wait_for_cdp; then
  echo "CDP Chrome was launched, but CDP is not reachable yet."
  echo "Check whether port $CHROME_CDP_PORT is already in use or Chrome blocked startup."
  echo "Then run: npm run check:cdp"
  exit 1
fi

echo "Mongi CDP Chrome is ready."
echo "Codex usage page and Claude usage page were opened."
echo "로그인이나 Turnstile이 보이면 Chrome에서 직접 통과하세요."
echo "다음 확인: npm run check:cdp"
echo "사용량 읽기: npm run monitor"
