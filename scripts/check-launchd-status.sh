#!/usr/bin/env bash
set -euo pipefail

LABEL="com.donghoon.mongi-usage-coach"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
OUT_LOG="$PROJECT_ROOT/logs/launchd-out.log"
ERROR_LOG="$PROJECT_ROOT/logs/launchd-error.log"
CDP_STATUS_PATH="/tmp/mongi-cdp-status.log"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

is_loaded() {
  launchctl list "$LABEL" >/dev/null 2>&1
}

print_log_tail() {
  local label="$1"
  local path="$2"

  echo
  echo "$label: $path"

  if [[ -f "$path" ]]; then
    tail -n 20 "$path"
  else
    echo "not found"
  fi
}

echo "LaunchAgent label: $LABEL"
echo "Plist exists: $([[ -f "$PLIST_PATH" ]] && echo "yes" || echo "no")"
echo "Plist path: $PLIST_PATH"

if is_loaded; then
  echo "LaunchAgent loaded: yes"
else
  echo "LaunchAgent loaded: no"
fi

echo "Out log path: $OUT_LOG"
echo "Error log path: $ERROR_LOG"

cd "$PROJECT_ROOT"

if command -v node >/dev/null 2>&1 && node scripts/check-cdp-status.js >"$CDP_STATUS_PATH" 2>&1; then
  echo "CDP reachable: yes"
else
  echo "CDP reachable: no"
fi

print_log_tail "Recent launchd stdout" "$OUT_LOG"
print_log_tail "Recent launchd stderr" "$ERROR_LOG"
