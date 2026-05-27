#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PACKAGE_SCRIPT="$PROJECT_ROOT/scripts/package-mongi-app.sh"
CONFIGURATION="${MONGI_CONFIGURATION:-Debug}"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

CONFIG_LOWER="$(printf "%s" "$CONFIGURATION" | tr "[:upper:]" "[:lower:]")"

case "$CONFIG_LOWER" in
  debug)
    CONFIG_DIR="Debug"
    ;;
  release)
    CONFIG_DIR="Release"
    ;;
  *)
    echo "Unsupported configuration: $CONFIGURATION" >&2
    exit 2
    ;;
esac

APP_PATH="$PROJECT_ROOT/dist/$CONFIG_DIR/Mongi.app"

if [ ! -x "$PACKAGE_SCRIPT" ]; then
  echo "Package script is missing or not executable: $PACKAGE_SCRIPT" >&2
  exit 1
fi

if ! command -v open >/dev/null 2>&1; then
  echo "Missing required tool: open" >&2
  exit 127
fi

"$PACKAGE_SCRIPT" --configuration "$CONFIGURATION"

if [ ! -d "$APP_PATH" ]; then
  echo "Packaged app not found: $APP_PATH" >&2
  exit 1
fi

echo "Opening Mongi menu bar app..."
open -n "$APP_PATH"
echo "Opened: $APP_PATH"
