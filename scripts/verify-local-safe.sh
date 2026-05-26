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

echo "Mongi safe local verification"
echo "No Discord messages will be sent during this run."
echo ""

run_step npm run test:state
run_step npm run test:scenarios
run_step npm run policy:check
run_step npm run check:cdp

echo
echo "==> DRY_RUN_NOTIFICATIONS=true npm run monitor"
DRY_RUN_NOTIFICATIONS=true npm run monitor

run_step npm run status:json
run_step npm run health

echo ""
echo "Safe verification completed."
echo "No Discord messages were sent."
echo ""
echo "To send a real Discord test message, run: npm run test:discord"
