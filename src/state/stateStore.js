const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");
const { timestampForFilename } = require("../utils/time");
const { createOutputStatusResult } = require("../output/gitOutputStatus");
const { BACKEND_IDS, FRESHNESS, SOURCE_STATUSES } = require("../backends/usageBackend");

const SCHEMA_VERSION = 3;

function createServiceState() {
  return {
    shortWindowPercent: null,
    weeklyPercent: null,
    lastShortWindowPercent: null,
    lastWeeklyPercent: null,
    rawShortWindowPercent: null,
    rawWeeklyPercent: null,
    rawShortWindowMeaning: "unknown",
    rawWeeklyPercentMeaning: "unknown",
    remainingShortWindowPercent: null,
    remainingWeeklyPercent: null,
    usedShortWindowPercent: null,
    usedWeeklyPercent: null,
    lastRemainingShortWindowPercent: null,
    lastRemainingWeeklyPercent: null,
    lastUsedShortWindowPercent: null,
    lastUsedWeeklyPercent: null,
    shortWindowLabel: null,
    weeklyWindowLabel: null,
    lastCheckedAt: null,
    lastAttemptedAt: null,
    lastSuccessfulCheckedAt: null,
    lastChangedAt: null,
    sessionSummarySent: false,
    lastShortRecoveredAt: null,
    lastWeeklyRecoveredAt: null,
    lastWeeklyFullReminderAt: null,
    consecutiveParseFailures: 0,
    lastParseFailureAt: null,
    lastParseFailedAt: null,
    lastParseFailureReason: null,
    lastParseFailureDigestAt: null,
    source: null
  };
}

function createDefaultState() {
  return {
    version: SCHEMA_VERSION,
    services: {
      codex: createServiceState(),
      claude: createServiceState()
    },
    sources: {
      codex: createSourceState("codex"),
      claude: createSourceState("claude")
    },
    output: createOutputStatusResult(),
    meta: {}
  };
}

function createSourceState(source) {
  return {
    source,
    backend: BACKEND_IDS.CDP,
    status: SOURCE_STATUSES.MISSING,
    freshness: FRESHNESS.UNKNOWN,
    usage: null,
    lastFreshReadAt: null,
    lastAttemptAt: null,
    consecutiveFailures: 0,
    lastError: null,
    lastRecoveryAction: null,
    lastReloadAt: null,
    target: null
  };
}

function ensureStateDirectory(stateFilePath) {
  const directory = path.dirname(stateFilePath);
  fs.mkdirSync(directory, { recursive: true });
}

function saveState(config, state) {
  const stateFilePath = config.stateFilePath;
  ensureStateDirectory(stateFilePath);

  const tempFilePath = `${stateFilePath}.tmp.${process.pid}`;
  const payload = `${JSON.stringify(state, null, 2)}\n`;

  fs.writeFileSync(tempFilePath, payload, "utf8");
  fs.renameSync(tempFilePath, stateFilePath);
}

function backupCorruptState(stateFilePath) {
  const backupPath = `${stateFilePath}.corrupt.${timestampForFilename()}`;
  fs.renameSync(stateFilePath, backupPath);
  return backupPath;
}

function normalizeState(state) {
  const defaultState = createDefaultState();
  const codex = normalizeServiceState(state.services && state.services.codex, defaultState.services.codex);
  const claude = normalizeServiceState(state.services && state.services.claude, defaultState.services.claude);
  const sources = {
    codex: normalizeSourceState(state.sources && state.sources.codex, codex, "codex"),
    claude: normalizeSourceState(state.sources && state.sources.claude, claude, "claude")
  };
  const normalized = {
    ...defaultState,
    ...state,
    version: SCHEMA_VERSION,
    services: {
      codex,
      claude
    },
    sources,
    output: normalizeOutputState(state.output, defaultState.output),
    meta: state.meta && typeof state.meta === "object" && !Array.isArray(state.meta) ? state.meta : {}
  };

  normalized.meta.lastCdpUnreachableDigestAt = normalized.meta.lastCdpUnreachableDigestAt || null;

  return normalized;
}

function normalizeOutputState(outputState, defaultOutputState) {
  const output = {
    ...defaultOutputState,
    ...(outputState || {})
  };

  output.repository = {
    ...defaultOutputState.repository,
    ...(output.repository || {})
  };

  output.details = {
    ...defaultOutputState.details,
    ...(output.details || {})
  };

  if (!["NO_OUTPUT", "LOCAL_ONLY", "SHIPPED"].includes(output.outputStatus)) {
    output.outputStatus = "NO_OUTPUT";
    output.reason = "invalid_output_status_normalized";
  }

  return output;
}

function normalizeMeaning(value) {
  return ["remaining", "used", "unknown"].includes(value) ? value : "unknown";
}

function normalizeServiceState(serviceState, defaultServiceState) {
  const service = {
    ...defaultServiceState,
    ...(serviceState || {})
  };

  service.rawShortWindowMeaning = normalizeMeaning(service.rawShortWindowMeaning);
  service.rawWeeklyPercentMeaning = normalizeMeaning(service.rawWeeklyPercentMeaning);

  if (service.rawShortWindowPercent === null && service.shortWindowPercent !== null) {
    service.rawShortWindowPercent = service.shortWindowPercent;
    service.rawShortWindowMeaning = "unknown";
  }

  if (service.rawWeeklyPercent === null && service.weeklyPercent !== null) {
    service.rawWeeklyPercent = service.weeklyPercent;
    service.rawWeeklyPercentMeaning = "unknown";
  }

  if (service.lastRemainingShortWindowPercent === undefined) {
    service.lastRemainingShortWindowPercent = null;
  }

  if (service.lastRemainingWeeklyPercent === undefined) {
    service.lastRemainingWeeklyPercent = null;
  }

  if (service.usedShortWindowPercent === undefined) {
    service.usedShortWindowPercent = null;
  }

  if (service.usedWeeklyPercent === undefined) {
    service.usedWeeklyPercent = null;
  }

  if (service.lastUsedShortWindowPercent === undefined) {
    service.lastUsedShortWindowPercent = null;
  }

  if (service.lastUsedWeeklyPercent === undefined) {
    service.lastUsedWeeklyPercent = null;
  }

  if (service.shortWindowLabel === undefined) {
    service.shortWindowLabel = null;
  }

  if (service.weeklyWindowLabel === undefined) {
    service.weeklyWindowLabel = null;
  }

  if (service.lastAttemptedAt === undefined) {
    service.lastAttemptedAt = service.lastCheckedAt || null;
  }

  if (service.lastSuccessfulCheckedAt === undefined) {
    service.lastSuccessfulCheckedAt = Number(service.consecutiveParseFailures || 0) > 0 ? null : service.lastCheckedAt || null;
  }

  if (service.lastParseFailedAt === undefined) {
    service.lastParseFailedAt = service.lastParseFailureAt || null;
  }

  if (service.lastParseFailureReason === undefined) {
    service.lastParseFailureReason = null;
  }

  if (service.source === undefined) {
    service.source = null;
  }

  return service;
}

function normalizeStatus(value) {
  return Object.values(SOURCE_STATUSES).includes(value) ? value : SOURCE_STATUSES.MISSING;
}

function normalizeFreshness(value) {
  return Object.values(FRESHNESS).includes(value) ? value : FRESHNESS.UNKNOWN;
}

function usageFromServiceState(service) {
  if (!service) {
    return null;
  }

  const hasUsage = [
    service.shortWindowPercent,
    service.weeklyPercent,
    service.rawShortWindowPercent,
    service.rawWeeklyPercent,
    service.remainingShortWindowPercent,
    service.remainingWeeklyPercent,
    service.usedShortWindowPercent,
    service.usedWeeklyPercent
  ].some((value) => value !== null && value !== undefined);

  if (!hasUsage) {
    return null;
  }

  return {
    shortWindowPercent: service.shortWindowPercent,
    weeklyPercent: service.weeklyPercent,
    rawShortWindowPercent: service.rawShortWindowPercent,
    rawWeeklyPercent: service.rawWeeklyPercent,
    rawShortWindowMeaning: service.rawShortWindowMeaning || "unknown",
    rawWeeklyPercentMeaning: service.rawWeeklyPercentMeaning || "unknown",
    remainingShortWindowPercent: service.remainingShortWindowPercent,
    remainingWeeklyPercent: service.remainingWeeklyPercent,
    usedShortWindowPercent: service.usedShortWindowPercent,
    usedWeeklyPercent: service.usedWeeklyPercent,
    shortWindowLabel: service.shortWindowLabel || null,
    weeklyWindowLabel: service.weeklyWindowLabel || null
  };
}

function targetFromServiceState(service) {
  const selectedTab = service && service.source && service.source.selectedTab;

  if (!selectedTab) {
    return null;
  }

  return {
    targetId: selectedTab.targetId || null,
    url: selectedTab.url || "",
    title: selectedTab.title || "",
    matchType: selectedTab.matchType || null
  };
}

function normalizeSourceState(sourceState, serviceState, source) {
  const defaultSource = createSourceState(source);
  const serviceFailures = Number(serviceState && serviceState.consecutiveParseFailures || 0);
  const usage = sourceState && sourceState.usage !== undefined ? sourceState.usage : usageFromServiceState(serviceState);
  const lastFreshReadAt = (sourceState && sourceState.lastFreshReadAt) || (serviceState && serviceState.lastSuccessfulCheckedAt) || null;
  const lastAttemptAt = (sourceState && sourceState.lastAttemptAt) || (serviceState && serviceState.lastAttemptedAt) || null;
  const consecutiveFailures = Number((sourceState && sourceState.consecutiveFailures) || serviceFailures || 0);
  const status = sourceState && sourceState.status
    ? normalizeStatus(sourceState.status)
    : lastFreshReadAt && consecutiveFailures === 0
      ? SOURCE_STATUSES.HEALTHY
      : usage
        ? SOURCE_STATUSES.STALE
        : SOURCE_STATUSES.MISSING;
  const freshness = sourceState && sourceState.freshness
    ? normalizeFreshness(sourceState.freshness)
    : lastFreshReadAt && consecutiveFailures === 0
      ? FRESHNESS.FRESH
      : usage
        ? FRESHNESS.STALE
        : FRESHNESS.UNKNOWN;

  return {
    ...defaultSource,
    ...(sourceState || {}),
    source,
    backend: (sourceState && sourceState.backend) || BACKEND_IDS.CDP,
    status,
    freshness,
    usage,
    lastFreshReadAt,
    lastAttemptAt,
    consecutiveFailures,
    lastError: (sourceState && sourceState.lastError !== undefined ? sourceState.lastError : serviceState && serviceState.lastParseFailureReason) || null,
    lastRecoveryAction: (sourceState && sourceState.lastRecoveryAction) || null,
    lastReloadAt: (sourceState && sourceState.lastReloadAt) || null,
    target: (sourceState && sourceState.target !== undefined ? sourceState.target : targetFromServiceState(serviceState)) || null
  };
}

function loadState(config) {
  const stateFilePath = config.stateFilePath;
  ensureStateDirectory(stateFilePath);

  if (!fs.existsSync(stateFilePath)) {
    const defaultState = createDefaultState();
    saveState(config, defaultState);
    return defaultState;
  }

  try {
    const raw = fs.readFileSync(stateFilePath, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("State JSON root must be an object.");
    }

    return normalizeState(parsed);
  } catch (error) {
    const backupPath = backupCorruptState(stateFilePath);
    logger.warn("Corrupt state file backed up. A fresh default state was created.", {
      backupPath,
      error
    });
    const defaultState = createDefaultState();
    saveState(config, defaultState);
    return defaultState;
  }
}

module.exports = {
  createDefaultState,
  createSourceState,
  loadState,
  saveState
};
