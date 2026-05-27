#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PACKAGE_PATH="$PROJECT_ROOT/macos/Mongi"
DIST_ROOT="${MONGI_DIST_DIR:-$PROJECT_ROOT/dist}"
APP_NAME="Mongi"
CONFIGURATION="${MONGI_CONFIGURATION:-release}"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

usage() {
  echo "Usage: $0 [--configuration Debug|Release]"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --configuration|-c)
      if [ "$#" -lt 2 ]; then
        echo "Missing value for $1" >&2
        usage >&2
        exit 2
      fi
      CONFIGURATION="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    exit 127
  fi
}

require_tool swift
require_tool plutil

CONFIG_LOWER="$(printf "%s" "$CONFIGURATION" | tr "[:upper:]" "[:lower:]")"

case "$CONFIG_LOWER" in
  debug)
    SWIFT_CONFIGURATION="debug"
    CONFIG_DIR="Debug"
    ;;
  release)
    SWIFT_CONFIGURATION="release"
    CONFIG_DIR="Release"
    ;;
  *)
    echo "Unsupported configuration: $CONFIGURATION" >&2
    usage >&2
    exit 2
    ;;
esac

APP_PATH="$DIST_ROOT/$CONFIG_DIR/$APP_NAME.app"
CONTENTS_PATH="$APP_PATH/Contents"
MACOS_PATH="$CONTENTS_PATH/MacOS"
RESOURCES_PATH="$CONTENTS_PATH/Resources"
INFO_PLIST="$CONTENTS_PATH/Info.plist"

echo "Building Mongi $CONFIG_DIR app..."
echo "Package path: $PACKAGE_PATH"

swift build --package-path "$PACKAGE_PATH" -c "$SWIFT_CONFIGURATION"
BIN_PATH="$(swift build --package-path "$PACKAGE_PATH" -c "$SWIFT_CONFIGURATION" --show-bin-path)"
EXECUTABLE="$BIN_PATH/$APP_NAME"

if [ ! -x "$EXECUTABLE" ]; then
  echo "Built executable not found: $EXECUTABLE" >&2
  exit 1
fi

rm -rf "$APP_PATH"
mkdir -p "$MACOS_PATH" "$RESOURCES_PATH"
cp "$EXECUTABLE" "$MACOS_PATH/$APP_NAME"
chmod 755 "$MACOS_PATH/$APP_NAME"

cat > "$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Mongi</string>
  <key>CFBundleExecutable</key>
  <string>Mongi</string>
  <key>CFBundleIdentifier</key>
  <string>com.donghoon.mongi</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Mongi</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

printf "APPL????" > "$CONTENTS_PATH/PkgInfo"
plutil -lint "$INFO_PLIST" >/dev/null

if command -v codesign >/dev/null 2>&1; then
  if codesign --force --sign - "$APP_PATH" >/dev/null 2>&1; then
    echo "Ad-hoc signed app bundle."
  else
    echo "Warning: ad-hoc signing failed; app bundle was still created." >&2
  fi
fi

echo "Mongi app packaged."
echo "Artifact: $APP_PATH"
