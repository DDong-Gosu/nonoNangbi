#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PACKAGE_PATH="$PROJECT_ROOT/macos/Mongi"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Look for a Xcode-built .app in DerivedData
DERIVED_APP=$(find "$HOME/Library/Developer/Xcode/DerivedData" -name "Mongi.app" -maxdepth 6 2>/dev/null | sort -r | head -1)

if [ -n "$DERIVED_APP" ] && [ -d "$DERIVED_APP" ]; then
  echo "Opening Xcode-built app: $DERIVED_APP"
  open "$DERIVED_APP"
  exit 0
fi

# Fall back to the swift build executable
EXECUTABLE="$PACKAGE_PATH/.build/debug/Mongi"
if [ -f "$EXECUTABLE" ]; then
  echo "No .app bundle found. Running swift build executable directly."
  echo "Note: Menu bar and Dock integration require a proper Xcode .app build."
  echo ""
  "$EXECUTABLE" &
  echo "Started Mongi (PID $!)"
  exit 0
fi

echo "No built app found."
echo ""
echo "To build and run the Mongi app:"
echo ""
echo "  Option 1 (recommended — full .app with menu bar):"
echo "    1. Open Xcode"
echo "    2. File > Open > select: $PACKAGE_PATH/Package.swift"
echo "    3. Select scheme 'Mongi' and press Run (cmd+R)"
echo ""
echo "  Option 2 (command-line build only):"
echo "    npm run build:app"
echo "    Then re-run: npm run open:app"
