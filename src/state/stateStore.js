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
    lastCheckedAt: null,
    lastChangedAt: null,
    sessionSummarySent: false,
    lastShortRecoveredAt: null,
    lastWeeklyRecoveredAt: null,
    lastWeeklyFullReminderAt: null,
    consecutiveParseFailures: 0,
    lastParseFailureAt: null
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
  const normalized = {
    ...defaultState,
    ...state,
    version: state.version || defaultState.version,
    services: {
      codex: {
        ...defaultState.services.codex,
        ...(state.services && state.services.codex ? state.services.codex : {})
      },
      claude: {
        ...defaultState.services.claude,
        ...(state.services && state.services.claude ? state.services.claude : {})
      }
    },
    meta: state.meta && typeof state.meta === "object" && !Array.isArray(state.meta) ? state.meta : {}
  };

  return normalized;
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
