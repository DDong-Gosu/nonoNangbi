const { nowIso } = require("../utils/time");
const { BACKEND_IDS, FRESHNESS, SOURCE_STATUSES } = require("../backends/usageBackend");

function ensureSourceState(state, serviceKey) {
  state.sources = state.sources || {};

  if (!state.sources[serviceKey]) {
    state.sources[serviceKey] = {
      source: serviceKey,
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

  return state.sources[serviceKey];
}

function usageFromParseResult(parseResult) {
  return {
    shortWindowPercent: parseResult.shortWindowPercent,
    weeklyPercent: parseResult.weeklyPercent,
    rawShortWindowPercent: parseResult.rawShortWindowPercent,
    rawWeeklyPercent: parseResult.rawWeeklyPercent,
    rawShortWindowMeaning: parseResult.rawShortWindowMeaning || "unknown",
    rawWeeklyPercentMeaning: parseResult.rawWeeklyPercentMeaning || "unknown",
    remainingShortWindowPercent: parseResult.remainingShortWindowPercent,
    remainingWeeklyPercent: parseResult.remainingWeeklyPercent,
    usedShortWindowPercent: parseResult.usedShortWindowPercent,
    usedWeeklyPercent: parseResult.usedWeeklyPercent,
    shortWindowLabel: parseResult.shortWindowLabel || null,
    weeklyWindowLabel: parseResult.weeklyWindowLabel || null,
    parseMethod: parseResult.parseMethod,
    parseConfidence: parseResult.parseConfidence
  };
}

function targetFromParseResult(parseResult, backendResult) {
  if (backendResult && backendResult.target !== undefined) {
    return backendResult.target;
  }

  const selectedTab = parseResult && parseResult.source && parseResult.source.selectedTab;

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

function updateSourceState(state, parseResult, backendResult, checkedAt) {
  const source = ensureSourceState(state, parseResult.serviceKey);
  const target = targetFromParseResult(parseResult, backendResult);

  source.backend = (backendResult && backendResult.backend) || source.backend || BACKEND_IDS.CDP;
  source.lastAttemptAt = checkedAt;
  source.lastRecoveryAction = backendResult && backendResult.lastRecoveryAction !== undefined ? backendResult.lastRecoveryAction : source.lastRecoveryAction || null;
  source.lastReloadAt = backendResult && backendResult.lastReloadAt ? backendResult.lastReloadAt : source.lastReloadAt || null;
  source.sourceReloadedAt = backendResult && backendResult.sourceReloadedAt ? backendResult.sourceReloadedAt : source.sourceReloadedAt || source.lastReloadAt || null;
  source.readAfterReload = backendResult && backendResult.readAfterReload !== undefined ? Boolean(backendResult.readAfterReload) : Boolean(source.readAfterReload);
  source.candidateCount = backendResult && backendResult.candidateCount !== undefined ? Number(backendResult.candidateCount || 0) : Number(source.candidateCount || 0);
  source.exactConfiguredUrlMatch = backendResult && backendResult.exactConfiguredUrlMatch !== undefined ? Boolean(backendResult.exactConfiguredUrlMatch) : Boolean(source.exactConfiguredUrlMatch);
  source.sourceUrlGuardPassed = backendResult && backendResult.sourceUrlGuardPassed !== undefined ? Boolean(backendResult.sourceUrlGuardPassed) : Boolean(source.sourceUrlGuardPassed);
  source.expectedUsageLabelsPresent = backendResult && backendResult.expectedUsageLabelsPresent !== undefined ? backendResult.expectedUsageLabelsPresent : source.expectedUsageLabelsPresent !== undefined ? source.expectedUsageLabelsPresent : null;
  source.freshnessDecisionReason = backendResult && backendResult.freshnessDecisionReason ? backendResult.freshnessDecisionReason : source.freshnessDecisionReason || null;

  if (target !== null || (backendResult && backendResult.target === null)) {
    source.target = target;
  }

  if (parseResult.ok) {
    source.status = (backendResult && backendResult.status) || SOURCE_STATUSES.HEALTHY;
    source.freshness = (backendResult && backendResult.freshness) || FRESHNESS.FRESH;
    source.usage = usageFromParseResult(parseResult);
    source.lastFreshReadAt = checkedAt;
    source.consecutiveFailures = 0;
    source.lastError = null;
    source.lastParseFailedAt = null;
    source.lastFailureAt = null;
    return;
  }

  source.status = (backendResult && backendResult.status) || (source.usage ? SOURCE_STATUSES.STALE : SOURCE_STATUSES.FAILED);
  source.freshness = (backendResult && backendResult.freshness) || (source.usage ? FRESHNESS.STALE : FRESHNESS.UNKNOWN);
  source.consecutiveFailures = Number(source.consecutiveFailures || 0) + 1;
  source.lastError = (backendResult && backendResult.lastError) || parseResult.errorReason || "read_failed";
  source.lastParseFailedAt = checkedAt;
  source.lastFailureAt = checkedAt;
}

function updateServiceState(state, parseResult, backendResult = null) {
  const current = state.services[parseResult.serviceKey];
  const checkedAt = nowIso();

  if (!current) {
    return;
  }

  updateSourceState(state, parseResult, backendResult, checkedAt);

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
