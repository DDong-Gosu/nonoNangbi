const { detectCdpUnreachableEvent, detectEvents } = require("../src/events/eventDetector");
const { dispatchNotifications, applyNotificationPatches } = require("../src/notifications/notificationDispatcher");
const { parseClaudeUsage } = require("../src/parsers/claudeParser");
const { createDefaultState } = require("../src/state/stateStore");
const { updateServiceState } = require("../src/state/serviceStateUpdater");

const baseConfig = {
  idleMinutesBeforeSummary: 20,
  weeklyFullReminderHours: 4,
  quietHours: {
    enabled: true,
    startHour: 23,
    endHour: 8
  }
};

const services = {
  codex: { key: "codex", name: "Codex" },
  claude: { key: "claude", name: "Claude" }
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeServiceState(overrides = {}) {
  return {
    rawShortWindowPercent: null,
    rawWeeklyPercent: null,
    rawShortWindowMeaning: "unknown",
    rawWeeklyPercentMeaning: "unknown",
    remainingShortWindowPercent: null,
    remainingWeeklyPercent: null,
    lastRemainingShortWindowPercent: null,
    lastRemainingWeeklyPercent: null,
    sessionSummarySent: false,
    lastChangedAt: null,
    lastWeeklyFullReminderAt: null,
    consecutiveParseFailures: 0,
    lastParseFailureDigestAt: null,
    ...overrides
  };
}

async function dispatchDry(events, config = baseConfig, now = new Date("2026-05-26T10:00:00+09:00")) {
  let sendCount = 0;
  const results = await dispatchNotifications({
    config,
    events,
    now,
    dryRun: true,
    sender: async () => {
      sendCount += 1;
    }
  });

  return { results, sendCount };
}

function detect(previous, current, service, now = new Date("2026-05-26T10:00:00+09:00"), config = baseConfig, parseSucceeded = true) {
  return detectEvents({
    previousServiceState: previous,
    currentServiceState: current,
    service,
    config,
    now,
    parseSucceeded
  });
}

async function main() {
  const scenarioResults = [];

  {
    const events = detect(
      makeServiceState({ remainingShortWindowPercent: 70, remainingWeeklyPercent: 95 }),
      makeServiceState({ remainingShortWindowPercent: 100, remainingWeeklyPercent: 95 }),
      services.codex
    );
    assert(events.some((event) => event.type === "recovered_short"), "Codex recovered short event missing.");
    scenarioResults.push("Codex recovered short");
  }

  {
    const events = detect(
      makeServiceState({ remainingShortWindowPercent: 80, remainingWeeklyPercent: 60 }),
      makeServiceState({ remainingShortWindowPercent: 80, remainingWeeklyPercent: 100 }),
      services.codex
    );
    assert(events.some((event) => event.type === "recovered_weekly"), "Codex recovered weekly event missing.");
    scenarioResults.push("Codex recovered weekly");
  }

  {
    const parseResult = parseClaudeUsage({
      serviceKey: "claude",
      serviceName: "Claude",
      bodyText: "Claude Code\n5 hours usage 10% used\nWeekly usage 20% used",
      candidateLines: [
        "5 hours usage 10% used",
        "Weekly usage 20% used"
      ],
      domCandidates: [],
      accessibilityCandidates: [],
      error: null,
      loginState: { loginLikely: false, textLooksUsage: true },
      turnstileState: { turnstileLikely: false }
    });
    assert(parseResult.rawShortWindowPercent === 10, "Claude raw short used percent should be 10.");
    assert(parseResult.remainingShortWindowPercent === 90, "Claude used short percent should normalize to remaining 90.");
    assert(parseResult.remainingWeeklyPercent === 80, "Claude used weekly percent should normalize to remaining 80.");
    const events = detect(
      makeServiceState({ remainingShortWindowPercent: 100, remainingWeeklyPercent: 100 }),
      makeServiceState({ remainingShortWindowPercent: 90, remainingWeeklyPercent: 80 }),
      services.claude
    );
    assert(events.length === 1 && events[0].type === "usage_active", "Claude usage_active should be detected from normalized remaining decrease.");
    const { results } = await dispatchDry(events);
    assert(results[0].sent === false && results[0].suppressed === "usage_active", "usage_active should not send Discord.");
    scenarioResults.push("Claude used percent normalization and usage_active");
  }

  {
    const now = new Date("2026-05-26T10:30:00+09:00");
    const previous = makeServiceState({ remainingShortWindowPercent: 80, remainingWeeklyPercent: 95 });
    const current = makeServiceState({
      remainingShortWindowPercent: 80,
      remainingWeeklyPercent: 95,
      lastChangedAt: "2026-05-26T10:00:00+09:00",
      sessionSummarySent: false
    });
    const events = detect(previous, current, services.codex, now);
    assert(events.some((event) => event.type === "session_stopped"), "session_stopped event missing.");
    scenarioResults.push("Session stopped after idle threshold");
  }

  {
    const events = detect(
      makeServiceState({ remainingShortWindowPercent: 100, remainingWeeklyPercent: 100 }),
      makeServiceState({ remainingShortWindowPercent: 100, remainingWeeklyPercent: 100 }),
      services.claude
    );
    assert(events.some((event) => event.type === "weekly_idle"), "weekly_idle event missing.");
    scenarioResults.push("Weekly idle reminder");
  }

  {
    const events = detect(
      makeServiceState({ remainingShortWindowPercent: 100, remainingWeeklyPercent: 100 }),
      makeServiceState({
        remainingShortWindowPercent: 100,
        remainingWeeklyPercent: 100,
        lastWeeklyFullReminderAt: "2026-05-26T08:00:00+09:00"
      }),
      services.claude,
      new Date("2026-05-26T10:00:00+09:00")
    );
    assert(!events.some((event) => event.type === "weekly_idle"), "weekly_idle duplicate should be prevented.");
    scenarioResults.push("Weekly idle duplicate prevention");
  }

  {
    const quietConfig = {
      ...baseConfig,
      quietHours: { enabled: true, startHour: 23, endHour: 8 }
    };
    const events = [
      {
        type: "recovered_short",
        serviceKey: "codex",
        serviceName: "Codex",
        remainingShortWindowPercent: 100,
        remainingWeeklyPercent: 90,
        occurredAt: "2026-05-26T23:30:00+09:00"
      }
    ];
    const { results } = await dispatchDry(events, quietConfig, new Date("2026-05-26T23:30:00+09:00"));
    assert(results[0].sent === false && results[0].suppressed === "quiet_hours", "quiet hours should suppress notifications.");
    scenarioResults.push("Quiet hours suppression");
  }

  {
    const events = detect(
      makeServiceState({ remainingShortWindowPercent: 80, remainingWeeklyPercent: 90 }),
      makeServiceState({
        remainingShortWindowPercent: 80,
        remainingWeeklyPercent: 90,
        consecutiveParseFailures: 3,
        lastParseFailureDigestAt: "2026-05-26T01:00:00+09:00"
      }),
      services.codex,
      new Date("2026-05-26T10:00:00+09:00"),
      baseConfig,
      false
    );
    assert(events.some((event) => event.type === "parse_failure_digest"), "parse failure digest missing.");
    const duplicateEvents = detect(
      makeServiceState({ remainingShortWindowPercent: 80, remainingWeeklyPercent: 90 }),
      makeServiceState({
        remainingShortWindowPercent: 80,
        remainingWeeklyPercent: 90,
        consecutiveParseFailures: 4,
        lastParseFailureDigestAt: "2026-05-26T09:00:00+09:00"
      }),
      services.codex,
      new Date("2026-05-26T10:00:00+09:00"),
      baseConfig,
      false
    );
    assert(!duplicateEvents.some((event) => event.type === "parse_failure_digest"), "parse failure digest should be rate-limited.");
    scenarioResults.push("Parse failure digest rate limit");
  }

  {
    const state = createDefaultState();
    state.services.codex.remainingShortWindowPercent = 66;
    state.services.codex.remainingWeeklyPercent = 95;
    state.services.codex.rawShortWindowPercent = 66;
    state.services.codex.rawWeeklyPercent = 95;
    updateServiceState(state, {
      serviceKey: "codex",
      ok: true,
      shortWindowPercent: null,
      weeklyPercent: null,
      rawShortWindowPercent: null,
      rawWeeklyPercent: null,
      rawShortWindowMeaning: "unknown",
      rawWeeklyPercentMeaning: "unknown",
      remainingShortWindowPercent: null,
      remainingWeeklyPercent: null,
      errorReason: null
    });
    assert(state.services.codex.remainingShortWindowPercent === 66, "null parse result erased previous short remaining.");
    assert(state.services.codex.remainingWeeklyPercent === 95, "null parse result erased previous weekly remaining.");
    scenarioResults.push("Null parser result preserves previous valid state");
  }

  {
    const state = createDefaultState();
    const events = [
      {
        type: "weekly_idle",
        serviceKey: "claude",
        serviceName: "Claude",
        remainingShortWindowPercent: 100,
        remainingWeeklyPercent: 100,
        occurredAt: "2026-05-26T10:00:00+09:00"
      }
    ];
    const { results } = await dispatchDry(events);
    applyNotificationPatches(state, results);
    assert(Boolean(state.services.claude.lastWeeklyFullReminderAt), "dispatcher patch did not update weekly idle timestamp.");
    scenarioResults.push("Dispatcher patch application");
  }

  {
    const state = createDefaultState();
    state.meta.lastCdpUnreachableDigestAt = "2026-05-26T01:00:00+09:00";
    const event = detectCdpUnreachableEvent({
      state,
      config: baseConfig,
      now: new Date("2026-05-26T10:00:00+09:00"),
      errorReason: "cdp_unreachable"
    });
    assert(event && event.type === "cdp_unreachable_digest", "CDP unreachable digest missing.");
    state.meta.lastCdpUnreachableDigestAt = "2026-05-26T09:00:00+09:00";
    const duplicateEvent = detectCdpUnreachableEvent({
      state,
      config: baseConfig,
      now: new Date("2026-05-26T10:00:00+09:00"),
      errorReason: "cdp_unreachable"
    });
    assert(duplicateEvent === null, "CDP unreachable digest should be rate-limited.");
    scenarioResults.push("CDP unreachable digest rate limit");
  }

  console.log(JSON.stringify({ ok: true, scenarios: scenarioResults }, null, 2));
}

main().catch((error) => {
  console.error(`[ERROR] Scenario tests failed: ${error.message}`);
  process.exit(1);
});
