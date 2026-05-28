const BACKEND_IDS = {
  CDP: "cdp"
};

const SOURCE_STATUSES = {
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  STALE: "stale",
  RECONNECTING: "reconnecting",
  REFRESHING: "refreshing",
  MISSING: "missing",
  FAILED: "failed",
  DISABLED: "disabled"
};

const FRESHNESS = {
  FRESH: "fresh",
  STALE: "stale",
  UNKNOWN: "unknown",
  DISABLED: "disabled"
};

function createBackendDiagnostics(overrides = {}) {
  return {
    backend: BACKEND_IDS.CDP,
    status: SOURCE_STATUSES.DEGRADED,
    freshness: FRESHNESS.UNKNOWN,
    lastRecoveryAction: null,
    lastReloadAt: null,
    lastError: null,
    target: null,
    ...overrides
  };
}

module.exports = {
  BACKEND_IDS,
  FRESHNESS,
  SOURCE_STATUSES,
  createBackendDiagnostics
};
