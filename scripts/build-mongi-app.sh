#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PACKAGE_PATH="$PROJECT_ROOT/macos/Mongi"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

echo "Building Mongi Swift package..."
echo "Package path: $PACKAGE_PATH"
echo ""

swift build --package-path "$PACKAGE_PATH" 2>&1
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  echo ""
  echo "Build failed (exit $BUILD_EXIT)."
  echo "Check the errors above and fix any Swift compilation issues."
  exit $BUILD_EXIT
fi

echo ""
echo "Swift package build succeeded."

EXECUTABLE="$PACKAGE_PATH/.build/debug/Mongi"
if [ -f "$EXECUTABLE" ]; then
  echo "Executable: $EXECUTABLE"
fi

echo ""
echo "Note: swift build produces an executable, not a signed .app bundle."
echo "For daily use as a proper macOS app with menu bar support:"
echo ""
echo "  1. Open Xcode"
echo "  2. File > Open > select: $PACKAGE_PATH/Package.swift"
echo "  3. Select scheme 'Mongi'"
echo "  4. Product > Build (cmd+B) or Product > Run (cmd+R)"
echo "  5. Right-click the Mongi app in the Dock > Options > Keep in Dock"
