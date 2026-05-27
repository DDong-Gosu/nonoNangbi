#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

DIST_RELEASE_APP="$PROJECT_ROOT/dist/Release/Mongi.app"
DIST_DEBUG_APP="$PROJECT_ROOT/dist/Debug/Mongi.app"

if [ -d "$DIST_RELEASE_APP" ]; then
  echo "Opening packaged app: $DIST_RELEASE_APP"
  open "$DIST_RELEASE_APP"
  exit 0
fi

if [ -d "$DIST_DEBUG_APP" ]; then
  echo "Opening packaged app: $DIST_DEBUG_APP"
  open "$DIST_DEBUG_APP"
  exit 0
fi

DERIVED_APP=$(find "$HOME/Library/Developer/Xcode/DerivedData" -name "Mongi.app" -maxdepth 6 2>/dev/null | sort -r | head -1)

if [ -n "$DERIVED_APP" ] && [ -d "$DERIVED_APP" ]; then
  echo "Opening Xcode-built app: $DERIVED_APP"
  open "$DERIVED_APP"
  exit 0
fi

echo "No built app found."
echo ""
echo "To build and run the Mongi app:"
echo ""
echo "  Development:"
echo "    ./scripts/compile-and-run-mongi.sh"
echo ""
echo "  Packaging:"
echo "    ./scripts/package-mongi-app.sh"
