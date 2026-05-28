const fs = require("fs");

const { lockPath, ensureRuntimeDirs } = require("./paths");

// monitor.lock prevents two monitor processes from polling at the same time.
// The lock holds the pid of the live monitor plus its owner ("Mongi.app",
// "launchd", "cli", ...) so the macOS app can tell which process owns it and
// only terminate the ones it started itself.

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH: no such process. EPERM: process exists but we cannot signal it
    // (still counts as alive for duplicate-prevention purposes).
    return error.code === "EPERM";
  }
}

function readLock(filePath = lockPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLock(lock, filePath = lockPath) {
  ensureRuntimeDirs();
  const payload = `${JSON.stringify(lock, null, 2)}\n`;
  const tempPath = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tempPath, payload, "utf8");
  fs.renameSync(tempPath, filePath);
}

// Acquires the lock for the current process. If a different live process
// already holds it, returns { acquired: false, holder }. A lock left behind by
// a dead process (crash, SIGKILL) is treated as stale and replaced.
function acquireLock({ owner = "monitor", mode = "single", now = new Date() } = {}, filePath = lockPath) {
  const existing = readLock(filePath);

  if (existing && Number.isInteger(existing.pid) && existing.pid !== process.pid && isPidAlive(existing.pid)) {
    return { acquired: false, holder: existing, stale: false };
  }

  const staleHolder = existing && existing.pid !== process.pid ? existing : null;

  const lock = {
    pid: process.pid,
    owner,
    mode,
    createdAt: now.toISOString()
  };
  writeLock(lock, filePath);
  return { acquired: true, holder: lock, stale: Boolean(staleHolder), previousHolder: staleHolder };
}

// Updates createdAt-less liveness markers without changing ownership. Used by
// the loop heartbeat so a long-lived monitor keeps its lock obviously fresh.
function refreshLock({ owner, mode, now = new Date() } = {}, filePath = lockPath) {
  const existing = readLock(filePath);

  if (!existing || existing.pid !== process.pid) {
    // Someone else owns it (or it is gone). Re-acquire to reassert ownership
    // only if no live foreign process holds it.
    return acquireLock({ owner: owner || (existing && existing.owner) || "monitor", mode: mode || (existing && existing.mode) || "loop", now }, filePath);
  }

  const lock = {
    ...existing,
    owner: owner || existing.owner,
    mode: mode || existing.mode,
    refreshedAt: now.toISOString()
  };
  writeLock(lock, filePath);
  return { acquired: true, holder: lock };
}

// Releases the lock only when the current process owns it, so a slow exit can
// never delete a lock that a newer monitor has already taken over.
function releaseLock(pid = process.pid, filePath = lockPath) {
  const existing = readLock(filePath);

  if (existing && existing.pid === pid) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // already gone
    }
    return true;
  }

  return false;
}

module.exports = {
  isPidAlive,
  readLock,
  writeLock,
  acquireLock,
  refreshLock,
  releaseLock
};
