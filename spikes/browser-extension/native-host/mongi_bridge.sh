#!/bin/bash
# Launcher for the Mongi native messaging host (Chrome requires an executable
# path in the host manifest). Resolves to this directory's mongi_bridge.js.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/mongi_bridge.js"
