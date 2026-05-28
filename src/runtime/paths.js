const os = require("os");
const path = require("path");
const fs = require("fs");

// Single source of truth for Mongi runtime file locations.
// Production defaults are macOS standard locations and do not depend on
// process.cwd() or the project root. MONGI_HOME overrides the data dir
// (used by tests to isolate runtime state into a temp directory).
function resolveAppSupportDir() {
  const override = process.env.MONGI_HOME;

  if (override && override.trim().length > 0) {
    return path.resolve(override.trim());
  }

  return path.join(os.homedir(), "Library", "Application Support", "Mongi");
}

function resolveLogsDir(appSupportDir) {
  const override = process.env.MONGI_LOGS_DIR;

  if (override && override.trim().length > 0) {
    return path.resolve(override.trim());
  }

  // When MONGI_HOME isolates the data dir (tests), keep logs alongside it.
  if (process.env.MONGI_HOME && process.env.MONGI_HOME.trim().length > 0) {
    return path.join(appSupportDir, "logs");
  }

  return path.join(os.homedir(), "Library", "Logs", "Mongi");
}

const appSupportDir = resolveAppSupportDir();
const logsDir = resolveLogsDir(appSupportDir);

const statePath = path.join(appSupportDir, "state.json");
const configPath = path.join(appSupportDir, "config.json");
const runtimePath = path.join(appSupportDir, "runtime.json");
const commandsPath = path.join(appSupportDir, "commands.json");
const lockPath = path.join(appSupportDir, "monitor.lock");
const monitorLogPath = path.join(logsDir, "monitor.log");
const errorLogPath = path.join(logsDir, "error.log");
const healthLogPath = path.join(logsDir, "health.log");

// Ensures both runtime directories exist. Throws on failure so callers can
// log the reason; never swallow the error silently.
function ensureRuntimeDirs() {
  fs.mkdirSync(appSupportDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = {
  appSupportDir,
  logsDir,
  statePath,
  configPath,
  runtimePath,
  commandsPath,
  lockPath,
  monitorLogPath,
  errorLogPath,
  healthLogPath,
  ensureRuntimeDirs
};
