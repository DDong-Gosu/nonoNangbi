const fs = require("fs");
const path = require("path");

const logger = require("../utils/logger");
const { timestampForFilename } = require("../utils/time");

const SCHEMA_VERSION = 1;

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
    lastRemainingShortWindowPercent: null,
    lastRemainingWeeklyPercent: null,
    lastCheckedAt: null,
    lastChangedAt: null,
    sessionSummarySent: false,
    lastShortRecoveredAt: null,
    lastWeeklyRecoveredAt: null,
    lastWeeklyFullReminderAt: null,
    consecutiveParseFailures: 0,
    lastParseFailureAt: null,
    lastParseFailureDigestAt: null
  };
}

function createDefaultState() {
  return {
    version: SCHEMA_VERSION,
    services: {
      codex: createServiceState(),
      claude: createServiceState()
    },
    meta: {}
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
  const normalized = {
    ...defaultState,
    ...state,
    version: state.version || defaultState.version,
    services: {
      codex,
      claude
    },
    meta: state.meta && typeof state.meta === "object" && !Array.isArray(state.meta) ? state.meta : {}
  };

  normalized.meta.lastCdpUnreachableDigestAt = normalized.meta.lastCdpUnreachableDigestAt || null;

  return normalized;
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

  return service;
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
  loadState,
  saveState
};
