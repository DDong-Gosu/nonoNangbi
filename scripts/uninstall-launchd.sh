#!/usr/bin/env bash
set -euo pipefail

LABEL="com.donghoon.mongi-usage-coach"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
BOOTOUT_ERROR_PATH="/tmp/mongi-launchd-uninstall-error.log"

is_loaded() {
  launchctl list "$LABEL" >/dev/null 2>&1
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "launchd uninstall is only available on macOS."
  exit 1
fi

if is_loaded; then
  echo "Unloading LaunchAgent..."

  if ! launchctl bootout "gui/$UID" "$PLIST_PATH" 2>"$BOOTOUT_ERROR_PATH"; then
    if ! launchctl bootout "gui/$UID/$LABEL" 2>"$BOOTOUT_ERROR_PATH"; then
      if [[ -f "$PLIST_PATH" ]]; then
        launchctl unload "$PLIST_PATH" 2>"$BOOTOUT_ERROR_PATH" || {
          echo "Failed to unload LaunchAgent."
          cat "$BOOTOUT_ERROR_PATH"
          exit 1
        }
      fi
    fi
  fi
else
  echo "LaunchAgent is not loaded."
fi

if [[ -f "$PLIST_PATH" ]]; then
  rm "$PLIST_PATH"
  echo "Removed plist: $PLIST_PATH"
else
  echo "Plist not found: $PLIST_PATH"
fi

echo "LaunchAgent uninstalled."
echo "Logs, state, .env, and Chrome profile were left untouched."
