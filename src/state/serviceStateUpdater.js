const { nowIso } = require("../utils/time");

function updateServiceState(state, parseResult) {
  const current = state.services[parseResult.serviceKey];
  const checkedAt = nowIso();

  if (!current) {
    return;
  }

  if (parseResult.ok) {
    current.lastAttemptedAt = checkedAt;
    current.lastShortWindowPercent = current.shortWindowPercent;
    current.lastWeeklyPercent = current.weeklyPercent;
    current.lastRemainingShortWindowPercent = current.remainingShortWindowPercent;
    current.lastRemainingWeeklyPercent = current.remainingWeeklyPercent;
    current.lastUsedShortWindowPercent = current.usedShortWindowPercent;
    current.lastUsedWeeklyPercent = current.usedWeeklyPercent;

    if (parseResult.shortWindowPercent !== null) {
      current.shortWindowPercent = parseResult.shortWindowPercent;
    }

    if (parseResult.weeklyPercent !== null) {
      current.weeklyPercent = parseResult.weeklyPercent;
    }

    if (parseResult.rawShortWindowPercent !== null) {
      current.rawShortWindowPercent = parseResult.rawShortWindowPercent;
      current.rawShortWindowMeaning = parseResult.rawShortWindowMeaning || "unknown";
    }

    if (parseResult.rawWeeklyPercent !== null) {
      current.rawWeeklyPercent = parseResult.rawWeeklyPercent;
      current.rawWeeklyPercentMeaning = parseResult.rawWeeklyPercentMeaning || "unknown";
    }

    if (parseResult.remainingShortWindowPercent !== null) {
      current.remainingShortWindowPercent = parseResult.remainingShortWindowPercent;
    }

    if (parseResult.remainingWeeklyPercent !== null) {
      current.remainingWeeklyPercent = parseResult.remainingWeeklyPercent;
    }

    if (parseResult.usedShortWindowPercent !== null && parseResult.usedShortWindowPercent !== undefined) {
      current.usedShortWindowPercent = parseResult.usedShortWindowPercent;
    }

    if (parseResult.usedWeeklyPercent !== null && parseResult.usedWeeklyPercent !== undefined) {
      current.usedWeeklyPercent = parseResult.usedWeeklyPercent;
    }

    if (parseResult.shortWindowLabel) {
      current.shortWindowLabel = parseResult.shortWindowLabel;
    }

    if (parseResult.weeklyWindowLabel) {
      current.weeklyWindowLabel = parseResult.weeklyWindowLabel;
    }

    current.lastCheckedAt = checkedAt;
    current.lastSuccessfulCheckedAt = checkedAt;
    current.consecutiveParseFailures = 0;
    current.lastParseFailureAt = null;
    current.lastParseFailedAt = null;
    current.lastParseFailureReason = null;
    current.source = parseResult.source || null;
    return;
  }

  current.lastAttemptedAt = checkedAt;
  current.consecutiveParseFailures = Number(current.consecutiveParseFailures || 0) + 1;
  current.lastParseFailureAt = checkedAt;
  current.lastParseFailedAt = checkedAt;
  current.lastParseFailureReason = parseResult.errorReason;
  current.source = parseResult.source || current.source || null;
}

function applyInternalEventState(state, events, now = new Date()) {
  const timestamp = new Date(now).toISOString();

  for (const event of events) {
    const serviceState = state.services[event.serviceKey];

    if (!serviceState) {
      continue;
    }

    if (event.type === "usage_active") {
      serviceState.lastChangedAt = timestamp;
      serviceState.sessionSummarySent = false;
    }
  }
}

module.exports = {
  applyInternalEventState,
  updateServiceState
};
