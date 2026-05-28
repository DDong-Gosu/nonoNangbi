const fs = require("fs");

const { runtimePath, ensureRuntimeDirs } = require("./paths");
const { isPidAlive } = require("./monitorLock");

const RUNTIME_VERSION = 1;

// How long the monitor heartbeat may go silent before a reader should treat the
// monitor as stale. The loop monitor refreshes the heartbeat every ~30s, so a
// 90s window tolerates a couple of missed beats without false alarms.
const DEFAULT_HEARTBEAT_STALE_MS = 90 * 1000;

const MONITOR_STATUS = {
  RUNNING: "running",
  STARTING: "starting",
  STOPPED: "stopped",
  STALE: "stale",
  CRASHED: "crashed",
  FAILED: "failed",
  UNKNOWN: "unknown"
};

function readRuntimeMeta(filePath = runtimePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeRuntimeMeta(meta, filePath = runtimePath) {
  ensureRuntimeDirs();
  const payload = `${JSON.stringify(meta, null, 2)}\n`;
  const tempPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tempPath, payload, "utf8");
  fs.renameSync(tempPath, filePath);
}

function mergeMonitor(existing, patch) {
  const base = existing && typeof existing === "object" ? existing : {};
  const monitor = base.monitor && typeof base.monitor === "object" ? base.monitor : {};
  return {
    ...base,
    version: base.version || RUNTIME_VERSION,
    monitor: {
      ...monitor,
      ...patch
    }
  };
}

// Marks the monitor as actively running. Preserves startedAt across heartbeats
// so the UI can show a stable session start time.
function recordMonitorRunning(options = {}, filePath = runtimePath) {
  const now = options.now || new Date();
  const existing = readRuntimeMeta(filePath);
  const previousMonitor = (existing && existing.monitor) || {};
  const iso = now.toISOString();

  const patch = {
    pid: process.pid,
    status: MONITOR_STATUS.RUNNING,
    startedAt: previousMonitor.startedAt && previousMonitor.pid === process.pid ? previousMonitor.startedAt : iso,
    lastHeartbeatAt: iso,
    updatedAt: iso,
    owner: options.owner || previousMonitor.owner || "monitor",
    mode: options.mode || previousMonitor.mode || "single",
    lastError: null
  };

  if (options.entrypoint) {
    patch.entrypoint = options.entrypoint;
  }
  if (options.nodePath) {
    patch.nodePath = options.nodePath;
  }

  const meta = mergeMonitor(existing, patch);
  writeRuntimeMeta(meta, filePath);
  return meta;
}

function recordMonitorHeartbeat(options = {}, filePath = runtimePath) {
  const now = options.now || new Date();
  const iso = now.toISOString();
  const existing = readRuntimeMeta(filePath);
  const previousMonitor = (existing && existing.monitor) || {};

  const patch = {
    pid: process.pid,
    status: MONITOR_STATUS.RUNNING,
    startedAt: previousMonitor.startedAt || iso,
    lastHeartbeatAt: iso,
    updatedAt: iso
  };
  if (options.owner) {
    patch.owner = options.owner;
  }

  const meta = mergeMonitor(existing, patch);
  writeRuntimeMeta(meta, filePath);
  return meta;
}

function recordMonitorStopped(options = {}, filePath = runtimePath) {
  const now = options.now || new Date();
  const iso = now.toISOString();
  const existing = readRuntimeMeta(filePath);

  const patch = {
    pid: null,
    status: options.status || MONITOR_STATUS.STOPPED,
    updatedAt: iso,
    stoppedAt: iso
  };
  if (options.error) {
    patch.status = options.status || MONITOR_STATUS.FAILED;
    patch.lastError = options.error;
  }

  const meta = mergeMonitor(existing, patch);
  writeRuntimeMeta(meta, filePath);
  return meta;
}

function ageMs(iso, now) {
  if (typeof iso !== "string") {
    return null;
  }
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return null;
  }
  return now.getTime() - then;
}

// Derives the effective monitor status from the recorded fields. A recorded
// status of "running" is only trusted when the pid is alive and the heartbeat
// is recent; otherwise the monitor is reported as crashed or stale. This is the
// single source of truth shared by the health check, status-json, and (mirrored)
// the macOS app.
function computeMonitorStatus(meta, options = {}) {
  const now = options.now || new Date();
  const staleMs = options.heartbeatStaleMs || DEFAULT_HEARTBEAT_STALE_MS;
  const monitor = (meta && meta.monitor) || {};
  const recorded = monitor.status || MONITOR_STATUS.UNKNOWN;
  const pid = Number.isInteger(monitor.pid) ? monitor.pid : null;
  const heartbeatAge = ageMs(monitor.lastHeartbeatAt, now);
  const pidAlive = pid !== null ? isPidAlive(pid) : false;

  let effective = recorded;

  if (recorded === MONITOR_STATUS.RUNNING || recorded === MONITOR_STATUS.STARTING) {
    if (pid === null) {
      effective = MONITOR_STATUS.UNKNOWN;
    } else if (!pidAlive) {
      effective = MONITOR_STATUS.CRASHED;
    } else if (heartbeatAge !== null && heartbeatAge > staleMs) {
      effective = MONITOR_STATUS.STALE;
    } else {
      effective = MONITOR_STATUS.RUNNING;
    }
  }

  return {
    recorded,
    effective,
    pid,
    pidAlive,
    owner: monitor.owner || null,
    mode: monitor.mode || null,
    heartbeatAgeMs: heartbeatAge,
    heartbeatStaleMs: staleMs,
    lastHeartbeatAt: monitor.lastHeartbeatAt || null,
    startedAt: monitor.startedAt || null,
    entrypoint: monitor.entrypoint || null,
    nodePath: monitor.nodePath || null,
    lastError: monitor.lastError || null
  };
}

module.exports = {
  RUNTIME_VERSION,
  MONITOR_STATUS,
  DEFAULT_HEARTBEAT_STALE_MS,
  readRuntimeMeta,
  writeRuntimeMeta,
  recordMonitorRunning,
  recordMonitorHeartbeat,
  recordMonitorStopped,
  computeMonitorStatus
};
