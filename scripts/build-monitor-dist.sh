#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DIST_ROOT="${MONGI_DIST_DIR:-$PROJECT_ROOT/dist}"
MONITOR_DIST="$DIST_ROOT/monitor"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

if ! command -v rsync >/dev/null 2>&1; then
  echo "Missing required tool: rsync" >&2
  exit 127
fi

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  echo "Missing package.json: $PROJECT_ROOT/package.json" >&2
  exit 1
fi

if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  echo "Missing node_modules. Run npm install before packaging." >&2
  exit 1
fi

rm -rf "$MONITOR_DIST"
mkdir -p "$MONITOR_DIST"

rsync -a "$PROJECT_ROOT/src" "$MONITOR_DIST/"
rsync -a "$PROJECT_ROOT/scripts" "$MONITOR_DIST/"
rsync -a "$PROJECT_ROOT/config" "$MONITOR_DIST/"
rsync -a "$PROJECT_ROOT/node_modules" "$MONITOR_DIST/"
cp "$PROJECT_ROOT/package.json" "$MONITOR_DIST/package.json"

if [ -f "$PROJECT_ROOT/package-lock.json" ]; then
  cp "$PROJECT_ROOT/package-lock.json" "$MONITOR_DIST/package-lock.json"
fi

if [ -f "$PROJECT_ROOT/.npmrc" ]; then
  cp "$PROJECT_ROOT/.npmrc" "$MONITOR_DIST/.npmrc"
fi

find "$MONITOR_DIST/scripts" -type f -name "*.sh" -exec chmod 755 {} \;

node -c "$MONITOR_DIST/src/monitor.js"
node -c "$MONITOR_DIST/scripts/status-json.js"
node -c "$MONITOR_DIST/scripts/health-check.js"

cat > "$MONITOR_DIST/runtime-manifest.json" <<JSON
{
  "version": 1,
  "createdAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "entrypoint": "src/monitor.js",
  "node": "system"
}
JSON

echo "Monitor dist built."
echo "Artifact: $MONITOR_DIST"
