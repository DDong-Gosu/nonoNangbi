const DIAGNOSTIC_FAILURE_THRESHOLD = 3;
const DIAGNOSTIC_RATE_LIMIT_HOURS = 6;

function toTime(value) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function hoursSince(value, now) {
  const time = toTime(value);

  if (time === null) {
    return Infinity;
  }

  return (new Date(now).getTime() - time) / 3600000;
}

function minutesSince(value, now) {
  const time = toTime(value);

  if (time === null) {
    return Infinity;
  }

  return (new Date(now).getTime() - time) / 60000;
}

function isQuietHours(config, now = new Date()) {
  if (!config.quietHours || !config.quietHours.enabled) {
    return false;
  }

  const hour = new Date(now).getHours();
  const start = config.quietHours.startHour;
  const end = config.quietHours.endHour;

  if (start === end) {
    return true;
  }

  if (start < end) {
    return hour >= start && hour < end;
  }

  return hour >= start || hour < end;
}

function hasDecreased(current, previous) {
  return current !== null && previous !== null && current < previous;
}

function hasRecovered(current, previous) {
  return current === 100 && previous !== null && previous < 100;
}

function isUnchanged(current, previous) {
  return current !== null && previous !== null && current === previous;
}

function baseEvent(type, service, currentServiceState, now) {
  return {
    type,
    serviceKey: service.key,
    serviceName: service.name,
    remainingShortWindowPercent: currentServiceState.remainingShortWindowPercent,
    remainingWeeklyPercent: currentServiceState.remainingWeeklyPercent,
    rawShortWindowPercent: currentServiceState.rawShortWindowPercent,
    rawWeeklyPercent: currentServiceState.rawWeeklyPercent,
    occurredAt: new Date(now).toISOString()
  };
}

function detectEvents({ previousServiceState, currentServiceState, service, config, now = new Date(), parseSucceeded = false }) {
  const events = [];
  const previousShort = previousServiceState.remainingShortWindowPercent;
  const previousWeekly = previousServiceState.remainingWeeklyPercent;
  const currentShort = currentServiceState.remainingShortWindowPercent;
  const currentWeekly = currentServiceState.remainingWeeklyPercent;
  const usageActive = hasDecreased(currentShort, previousShort) || hasDecreased(currentWeekly, previousWeekly);
  const quiet = isQuietHours(config, now);
  const recoveredShort = parseSucceeded && hasRecovered(currentShort, previousShort);
  const recoveredWeekly = parseSucceeded && hasRecovered(currentWeekly, previousWeekly);

  if (usageActive) {
    events.push(baseEvent("usage_active", service, currentServiceState, now));
    return events;
  }

  if (recoveredShort) {
    events.push(baseEvent("recovered_short", service, currentServiceState, now));
  }

  if (recoveredWeekly) {
    events.push(baseEvent("recovered_weekly", service, currentServiceState, now));
  }

  const idleMinutes = minutesSince(currentServiceState.lastChangedAt, now);
  const unchanged = isUnchanged(currentShort, previousShort) && isUnchanged(currentWeekly, previousWeekly);

  const sessionStopped = (
    parseSucceeded &&
    currentServiceState.lastChangedAt &&
    idleMinutes >= config.idleMinutesBeforeSummary &&
    unchanged &&
    currentServiceState.sessionSummarySent === false
  );

  if (sessionStopped) {
    events.push({
      ...baseEvent("session_stopped", service, currentServiceState, now),
      idleMinutes: Math.floor(idleMinutes)
    });
  }

  if (
    parseSucceeded &&
    previousWeekly === 100 &&
    currentWeekly === 100 &&
    !recoveredWeekly &&
    !sessionStopped &&
    !quiet &&
    hoursSince(currentServiceState.lastWeeklyFullReminderAt, now) >= config.weeklyFullReminderHours
  ) {
    events.push({
      ...baseEvent("weekly_idle", service, currentServiceState, now),
      reminderHours: config.weeklyFullReminderHours
    });
  }

  if (
    Number(currentServiceState.consecutiveParseFailures || 0) >= DIAGNOSTIC_FAILURE_THRESHOLD &&
    hoursSince(currentServiceState.lastParseFailureDigestAt, now) >= DIAGNOSTIC_RATE_LIMIT_HOURS
  ) {
    events.push({
      ...baseEvent("parse_failure_digest", service, currentServiceState, now),
      consecutiveParseFailures: currentServiceState.consecutiveParseFailures,
      errorReason: currentServiceState.lastParseFailureReason || "parser failure"
    });
  }

  return events;
}

function detectCdpUnreachableEvent({ state, config, now = new Date(), errorReason = "cdp unreachable" }) {
  if (hoursSince(state.meta && state.meta.lastCdpUnreachableDigestAt, now) < DIAGNOSTIC_RATE_LIMIT_HOURS) {
    return null;
  }

  return {
    type: "cdp_unreachable_digest",
    serviceKey: "cdp",
    serviceName: "Chrome CDP",
    remainingShortWindowPercent: null,
    remainingWeeklyPercent: null,
    rawShortWindowPercent: null,
    rawWeeklyPercent: null,
    errorReason,
    occurredAt: new Date(now).toISOString(),
    reminderHours: DIAGNOSTIC_RATE_LIMIT_HOURS,
    quiet: isQuietHours(config, now)
  };
}

module.exports = {
  detectCdpUnreachableEvent,
  detectEvents,
  isQuietHours
};
