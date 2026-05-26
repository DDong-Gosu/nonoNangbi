#!/usr/bin/env bash
set -euo pipefail

LABEL="com.donghoon.mongi-usage-coach"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TEMPLATE_PATH="$PROJECT_ROOT/launchd/$LABEL.plist.template"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$LABEL.plist"
BOOTSTRAP_ERROR_PATH="/tmp/mongi-launchd-bootstrap-error.log"
BOOTOUT_ERROR_PATH="/tmp/mongi-launchd-bootout-error.log"

is_loaded() {
  launchctl list "$LABEL" >/dev/null 2>&1
}

escape_sed_replacement() {
  printf "%s" "$1" | sed 's/[&\\]/\\&/g'
}

unload_existing() {
  if ! is_loaded; then
    return 0
  fi

  echo "Existing LaunchAgent is loaded. Unloading first..."

  if launchctl bootout "gui/$UID" "$PLIST_PATH" 2>"$BOOTOUT_ERROR_PATH"; then
    return 0
  fi

  if launchctl bootout "gui/$UID/$LABEL" 2>"$BOOTOUT_ERROR_PATH"; then
    return 0
  fi

  if [[ -f "$PLIST_PATH" ]] && launchctl unload "$PLIST_PATH" 2>"$BOOTOUT_ERROR_PATH"; then
    return 0
  fi

  echo "Failed to unload existing LaunchAgent."
  cat "$BOOTOUT_ERROR_PATH"
  exit 1
}

load_agent() {
  if launchctl bootstrap "gui/$UID" "$PLIST_PATH" 2>"$BOOTSTRAP_ERROR_PATH"; then
    return 0
  fi

  echo "launchctl bootstrap failed. Trying launchctl load..."
  cat "$BOOTSTRAP_ERROR_PATH"

  if launchctl load "$PLIST_PATH" 2>"$BOOTSTRAP_ERROR_PATH"; then
    return 0
  fi

  echo "Failed to load LaunchAgent."
  cat "$BOOTSTRAP_ERROR_PATH"
  echo "Manual alternatives:"
  echo "launchctl bootstrap gui/$UID \"$PLIST_PATH\""
  echo "launchctl load \"$PLIST_PATH\""
  exit 1
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "launchd install is only available on macOS."
  exit 1
fi

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Missing plist template: $TEMPLATE_PATH"
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/scripts/run-monitor.sh" ]]; then
  echo "Missing monitor wrapper: $PROJECT_ROOT/scripts/run-monitor.sh"
  exit 1
fi

chmod +x "$PROJECT_ROOT/scripts/run-monitor.sh"
chmod +x "$PROJECT_ROOT/scripts/install-launchd.sh"
chmod +x "$PROJECT_ROOT/scripts/uninstall-launchd.sh"
chmod +x "$PROJECT_ROOT/scripts/check-launchd-status.sh"
mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$LAUNCH_AGENTS_DIR"

unload_existing

escaped_project_root="$(escape_sed_replacement "$PROJECT_ROOT")"
sed "s#__PROJECT_ROOT__#$escaped_project_root#g" "$TEMPLATE_PATH" > "$PLIST_PATH"

plutil -lint "$PLIST_PATH" >/dev/null

load_agent

echo "LaunchAgent installed."
echo "Label: $LABEL"
echo "Plist: $PLIST_PATH"

if is_loaded; then
  echo "Loaded: yes"
else
  echo "Loaded: no"
fi

echo "Next commands:"
echo "npm run launchd:status"
echo "npm run launchd:logs"
echo "npm run start:chrome"
