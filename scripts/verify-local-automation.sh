#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$PROJECT_ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

run_step() {
  echo
  echo "==> $*"
  "$@"
}

has_discord_webhook() {
  [[ -f ".env" ]] && grep -Eq '^DISCORD_WEBHOOK_URL=.+$' ".env"
}

echo "Mongi local automation verification"
echo "This runs monitor once. A legitimate Discord notification may occur depending on current state."

run_step npm run check:cdp
run_step npm run test:state
run_step npm run test:scenarios
run_step npm run monitor
run_step npm run health
run_step npm run logs:summary

if has_discord_webhook; then
  run_step npm run test:discord
else
  echo
  echo "==> Discord test skipped: DISCORD_WEBHOOK_URL is not configured in .env"
fi

echo
echo "Local automation verification completed."
