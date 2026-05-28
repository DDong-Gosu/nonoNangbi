#!/usr/bin/env bash
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$PROJECT_ROOT"

mkdir -p logs

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Tag runtime.json/monitor.lock so readers can tell launchd-driven single-shot
# runs apart from the macOS app's long-lived loop monitor.
export MONGI_MONITOR_OWNER="${MONGI_MONITOR_OWNER:-launchd}"

echo "[$(date '+%Y-%m-%d %H:%M:%S %z')] Mongi monitor wrapper started."
echo "Project root: $PROJECT_ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "node not found in PATH: $PATH"
  exit 127
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found in PATH: $PATH"
  exit 127
fi

echo "Node: $(command -v node)"
echo "npm: $(command -v npm)"

npm run monitor
exit_code=$?

echo "[$(date '+%Y-%m-%d %H:%M:%S %z')] Mongi monitor wrapper finished with exit code $exit_code."

exit "$exit_code"
