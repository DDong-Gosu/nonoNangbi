const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { detectCdpUnreachableEvent, detectEvents } = require("../src/events/eventDetector");
const { dispatchNotifications, applyNotificationPatches } = require("../src/notifications/notificationDispatcher");
const { getEventMessage, getOutputStatusMessage, getStartMessage, lineCount } = require("../src/notifications/messages");
const { OUTPUT_STATUSES, classifyOutputStatus, getGitOutputStatus, getOutputStatusDisplay } = require("../src/output/gitOutputStatus");
const { parseClaudeUsage } = require("../src/parsers/claudeParser");
const { parseCodexUsage } = require("../src/parsers/codexParser");
const { createCdpBackend } = require("../src/backends/cdpBackend");
const { FRESHNESS, SOURCE_STATUSES } = require("../src/backends/usageBackend");
const { completeCommands, pendingCommands, readCommandStore, writeCommandStore } = require("../src/runtime/commandStore");
const { acquireLock, releaseLock, readLock, refreshLock } = require("../src/runtime/monitorLock");
const {
  recordMonitorRunning,
  recordMonitorHeartbeat,
  recordMonitorStopped,
  computeMonitorStatus,
  readRuntimeMeta
} = require("../src/runtime/runtimeMeta");
const { createDefaultState } = require("../src/state/stateStore");
const { updateServiceState } = require("../src/state/serviceStateUpdater");
const { selectUsagePageCandidate, serviceUsagePageMatches } = require("../src/extractors/usageExtractor");

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

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
}

function git(cwd, args, options = {}) {
  return run("git", args, { cwd, ...options });
}

function makeTempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

function commitFile(cwd, fileName, content, dateIso) {
  fs.writeFileSync(path.join(cwd, fileName), content, "utf8");
  git(cwd, ["add", fileName]);
  git(cwd, ["-c", "user.name=Mongi Test", "-c", "user.email=mongi@example.test", "commit", "-m", `commit ${fileName}`], {
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: dateIso,
      GIT_COMMITTER_DATE: dateIso
    }
  });
}

function initRepo(cwd) {
  git(cwd, ["init", "-b", "main"]);
}

function yesterdayIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function assertShortMessage(message, expectedStatus) {
  const display = getOutputStatusDisplay(expectedStatus);
  const firstLine = String(message).split(/\r?\n/)[0] || "";
  assert(lineCount(message) <= 3, `${expectedStatus} message exceeds 3 lines.`);
  assert(message.includes(display.label), `${expectedStatus} message is missing Korean status label.`);
  assert(!firstLine.includes(expectedStatus), `${expectedStatus} message exposes raw enum as primary label.`);
  assert(!message.includes("nextAction"), `${expectedStatus} message leaked nextAction wording.`);
  assert(!message.includes("Mongi is running normally"), `${expectedStatus} message leaked complex status wording.`);
}

function makeServiceState(overrides = {}) {
  return {
    rawShortWindowPercent: null,
    rawWeeklyPercent: null,
    rawShortWindowMeaning: "unknown",
    rawWeeklyPercentMeaning: "unknown",
    remainingShortWindowPercent: null,
    remainingWeeklyPercent: null,
    usedShortWindowPercent: null,
    usedWeeklyPercent: null,
    lastUsedShortWindowPercent: null,
    lastUsedWeeklyPercent: null,
    shortWindowLabel: null,
    weeklyWindowLabel: null,
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

function makeReadResult(serviceKey, ok, overrides = {}) {
  const serviceName = serviceKey === "claude" ? "Claude" : "Codex";
  const source = overrides.source || {
    selected: true,
    selectedTab: {
      targetId: `${serviceKey}-target`,
      url: serviceKey === "claude" ? "https://claude.ai/settings/usage" : "https://chatgpt.com/codex/cloud/settings/analytics#usage",
      title: serviceName,
      matchType: "provider_url_pattern"
    }
  };

  return {
    extraction: {
      serviceKey,
      serviceName,
      navigationStatus: null,
      source,
      error: ok ? null : { reason: overrides.errorReason || "parser_low_confidence" }
    },
    parseResult: {
      serviceKey,
      serviceName,
      ok,
      shortWindowPercent: ok ? 80 : null,
      weeklyPercent: ok ? 90 : null,
      rawShortWindowPercent: ok ? 80 : null,
      rawWeeklyPercent: ok ? 90 : null,
      rawShortWindowMeaning: ok ? "remaining" : "unknown",
      rawWeeklyPercentMeaning: ok ? "remaining" : "unknown",
      remainingShortWindowPercent: ok ? 80 : null,
      remainingWeeklyPercent: ok ? 90 : null,
      usedShortWindowPercent: ok ? 20 : null,
      usedWeeklyPercent: ok ? 10 : null,
      shortWindowLabel: ok ? "5-hour remaining" : null,
      weeklyWindowLabel: ok ? "weekly remaining" : null,
      parseMethod: ok ? "mock_success" : "mock_failure",
      parseConfidence: ok ? "high" : "none",
      rawTextSample: "",
      parsedAt: "2026-05-28T01:00:00.000Z",
      errorReason: ok ? null : overrides.errorReason || "parser_low_confidence",
      source,
      selectedCandidates: {
        shortWindow: null,
        weekly: null
      }
    }
  };
}

async function dispatchDry(events, config = baseConfig, now = new Date("2026-05-26T10:00:00+09:00"), options = {}) {
  let sendCount = 0;
  const results = await dispatchNotifications({
    config,
    events,
    now,
    dryRun: true,
    sender: async () => {
      sendCount += 1;
    },
    ...options
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
    const selected = selectUsagePageCandidate([
      {
        index: 0,
        url: "https://chatgpt.com/codex/cloud/settings/analytics",
        title: "Old Codex",
        matchType: "exact_configured_url",
        score: 100
      },
      {
        index: 1,
        url: "https://chatgpt.com/codex/cloud/settings/analytics",
        title: "Current Codex",
        matchType: "exact_configured_url",
        score: 100
      }
    ]);
    assert(selected.index === 1, "Source selection should prefer the later equally scored matching tab.");
    assert(serviceUsagePageMatches({ key: "codex", usageUrl: "https://chatgpt.com/codex/cloud/settings/analytics#usage" }, "https://claude.ai/settings/usage") === false, "Codex source selection must reject Claude tabs.");
    scenarioResults.push("Source selection prefers fresher matching provider tab");
  }

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
    assert(parseResult.usedShortWindowPercent === 10, "Claude short used percent should persist as used 10.");
    assert(parseResult.usedWeeklyPercent === 20, "Claude weekly used percent should persist as used 20.");
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
    const parseResult = parseCodexUsage({
      serviceKey: "codex",
      serviceName: "Codex",
      bodyText: "Codex usage\n5-hour usage limit\n85% remaining\nWeekly usage limit\n51% remaining",
      candidateLines: [
        "5-hour usage limit",
        "85% remaining",
        "Weekly usage limit",
        "51% remaining"
      ],
      domCandidates: [],
      accessibilityCandidates: [],
      error: null,
      loginState: { loginLikely: false, textLooksUsage: true },
      turnstileState: { turnstileLikely: false }
    });
    assert(parseResult.remainingShortWindowPercent === 85, "Codex 5-hour remaining should parse as short remaining 85.");
    assert(parseResult.remainingWeeklyPercent === 51, "Codex weekly remaining should parse as weekly remaining 51.");
    assert(parseResult.usedShortWindowPercent === 15, "Codex short used should derive to 15.");
    assert(parseResult.usedWeeklyPercent === 49, "Codex weekly used should derive to 49.");
    assert(parseResult.rawShortWindowMeaning === "remaining", "Codex short meaning should be remaining.");
    assert(parseResult.rawWeeklyPercentMeaning === "remaining", "Codex weekly meaning should be remaining.");
    scenarioResults.push("Codex latest screenshot fixture maps short 85 and weekly 51 remaining");
  }

  {
    const parseResult = parseClaudeUsage({
      serviceKey: "claude",
      serviceName: "Claude",
      bodyText: "Claude usage\nCurrent session\n50% used\nAll models\n7% used",
      candidateLines: [
        "Current session",
        "50% used",
        "All models",
        "7% used"
      ],
      domCandidates: [],
      accessibilityCandidates: [],
      error: null,
      loginState: { loginLikely: false, textLooksUsage: true },
      turnstileState: { turnstileLikely: false }
    });
    assert(parseResult.usedShortWindowPercent === 50, "Claude current session should parse as short used 50.");
    assert(parseResult.usedWeeklyPercent === 7, "Claude all-models should parse as weekly/all-models used 7.");
    assert(parseResult.remainingShortWindowPercent === 50, "Claude current session used 50 should derive remaining 50.");
    assert(parseResult.remainingWeeklyPercent === 93, "Claude all-models used 7 should derive remaining 93.");
    assert(parseResult.rawShortWindowMeaning === "used", "Claude short meaning should be used.");
    assert(parseResult.rawWeeklyPercentMeaning === "used", "Claude weekly meaning should be used.");
    scenarioResults.push("Claude latest screenshot fixture maps current session 50 used and all-models 7 used");
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
      usedShortWindowPercent: null,
      usedWeeklyPercent: null,
      errorReason: null
    });
    assert(state.services.codex.remainingShortWindowPercent === 66, "null parse result erased previous short remaining.");
    assert(state.services.codex.remainingWeeklyPercent === 95, "null parse result erased previous weekly remaining.");
    scenarioResults.push("Null parser result preserves previous valid state");
  }

  {
    // Use a mock sender (no dryRun) so patches are applied correctly.
    // dryRun mode intentionally skips patches to avoid state mutation without real send.
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
    const results = await dispatchNotifications({
      config: baseConfig,
      events,
      now: new Date("2026-05-26T10:00:00+09:00"),
      dryRun: false,
      sender: async () => {}
    });
    applyNotificationPatches(state, results);
    assert(Boolean(state.services.claude.lastWeeklyFullReminderAt), "dispatcher patch did not update weekly idle timestamp.");
    scenarioResults.push("Dispatcher patch application");
  }

  {
    const state = createDefaultState();
    const parseResult = parseCodexUsage({
      serviceKey: "codex",
      serviceName: "Codex",
      bodyText: "",
      candidateLines: [],
      domCandidates: [],
      accessibilityCandidates: [],
      error: {
        reason: "usage_page_not_open",
        message: "Codex usage page is not open.",
        rawTextSample: ""
      },
      loginState: { loginLikely: false, textLooksUsage: false },
      turnstileState: { turnstileLikely: false }
    });
    updateServiceState(state, parseResult);
    assert(parseResult.ok === false, "Missing usage page should not parse successfully.");
    assert(parseResult.errorReason === "usage_page_not_open", "Missing usage page reason should be preserved.");
    assert(state.services.codex.lastParseFailureReason === "usage_page_not_open", "Missing usage page reason should persist in state.");
    scenarioResults.push("Missing usage page graceful failure");
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

  {
    assert(getOutputStatusDisplay(OUTPUT_STATUSES.SHIPPED).label === "오늘 푸시함", "SHIPPED display label should be Korean.");
    assert(getOutputStatusDisplay(OUTPUT_STATUSES.LOCAL_ONLY).label === "로컬 작업만 있음", "LOCAL_ONLY display label should be Korean.");
    assert(getOutputStatusDisplay(OUTPUT_STATUSES.NO_OUTPUT).label === "산출물 없음", "NO_OUTPUT display label should be Korean.");

    const usage = {
      codex: { remainingShortWindowPercent: 99, remainingWeeklyPercent: 88 },
      claude: { remainingShortWindowPercent: 100, remainingWeeklyPercent: 75 }
    };
    const noOutput = getOutputStatusMessage({
      output: { outputStatus: OUTPUT_STATUSES.NO_OUTPUT },
      usage
    });
    assertShortMessage(noOutput, OUTPUT_STATUSES.NO_OUTPUT);
    assert(noOutput.includes("로컬 변경/푸시가 아직 없음"), "NO_OUTPUT message should describe missing local/pushed output in Korean.");
    assert(noOutput.includes("Codex 99/88"), "NO_OUTPUT message should include exact Codex percentages.");
    assert(noOutput.includes("Claude 100/75"), "NO_OUTPUT message should include exact Claude percentages.");
    assert(noOutput.includes("남음"), "NO_OUTPUT message should label usage as remaining.");

    const localOnly = getOutputStatusMessage({
      output: { outputStatus: OUTPUT_STATUSES.LOCAL_ONLY },
      usage
    });
    assertShortMessage(localOnly, OUTPUT_STATUSES.LOCAL_ONLY);
    assert(localOnly.includes("푸시"), "LOCAL_ONLY message should include a short ship-oriented action.");

    const shipped = getOutputStatusMessage({
      output: { outputStatus: OUTPUT_STATUSES.SHIPPED },
      usage
    });
    assertShortMessage(shipped, OUTPUT_STATUSES.SHIPPED);
    assert(shipped.includes("GitHub 산출물"), "SHIPPED message should mention shipped output.");

    const missingUsage = getOutputStatusMessage({
      output: { outputStatus: OUTPUT_STATUSES.NO_OUTPUT },
      usage: {}
    });
    assertShortMessage(missingUsage, OUTPUT_STATUSES.NO_OUTPUT);
    assert(!missingUsage.includes("Codex"), "Missing usage should omit usage line.");

    const start = getStartMessage({
      output: { outputStatus: OUTPUT_STATUSES.LOCAL_ONLY },
      checkIntervalMinutes: 10
    });
    assert(lineCount(start) <= 3, "Start message exceeds 3 lines.");
    assert(start.includes("Mongi 시작"), "Start message should confirm startup.");
    assert(start.includes("10분마다 조용히 확인"), "Start message should include cadence.");
    assert(!start.includes("LOCAL_ONLY"), "Start message should not duplicate raw output status.");
    scenarioResults.push("V2 Discord messages are Korean-first and short");
  }

  {
    const events = [
      {
        type: "weekly_idle",
        serviceKey: "codex",
        serviceName: "Codex",
        occurredAt: "2026-05-26T10:00:00+09:00"
      }
    ];
    const output = { outputStatus: OUTPUT_STATUSES.LOCAL_ONLY };
    const usage = {
      codex: { remainingShortWindowPercent: 90, remainingWeeklyPercent: 80 }
    };
    const { results } = await dispatchDry(events, baseConfig, new Date("2026-05-26T10:00:00+09:00"), {
      output,
      usage
    });
    const message = getEventMessage(events[0], {
      output,
      usage
    });
    assert(results[0].message === message, "Dry-run dispatch should use V2 output status message.");
    assert(results[0].message.includes("Codex 90/80"), "Dry-run message should include exact usage percentage.");
    assert(results[0].suppressed === "dry_run", "Dry-run dispatch should still mark dry_run suppression.");
    assertShortMessage(message, OUTPUT_STATUSES.LOCAL_ONLY);
    scenarioResults.push("V2 event Discord message uses output status");
  }

  {
    const events = [
      {
        type: "recovered_short",
        serviceKey: "codex",
        serviceName: "Codex",
        occurredAt: "2026-05-26T23:30:00+09:00"
      }
    ];
    const output = { outputStatus: OUTPUT_STATUSES.SHIPPED };
    const { results } = await dispatchDry(events, baseConfig, new Date("2026-05-26T23:30:00+09:00"), {
      output,
      usage: {}
    });
    assert(results[0].sent === false && results[0].suppressed === "quiet_hours", "Quiet hours should suppress V2 Discord messages.");
    assert(output.outputStatus === OUTPUT_STATUSES.SHIPPED, "Quiet hours should not mutate output status.");
    scenarioResults.push("Quiet hours suppresses V2 Discord message without changing output status");
  }

  {
    const result = classifyOutputStatus({
      hasShippedToday: false,
      hasLocalChanges: false,
      hasUnpushedCommits: false,
      gitAvailable: true,
      quietHoursActive: true
    });
    assert(result.outputStatus === OUTPUT_STATUSES.NO_OUTPUT, "Quiet hours must not replace NO_OUTPUT core status.");
    assert(result.quietHoursActive === true, "Quiet hours modifier should be preserved.");
    scenarioResults.push("Quiet hours remains output status modifier");
  }

  {
    const repo = makeTempDir("mongi-no-output");
    initRepo(repo);
    const output = getGitOutputStatus({ cwd: repo, now: new Date(), quietHoursActive: false });
    assert(output.outputStatus === OUTPUT_STATUSES.NO_OUTPUT, "Clean empty repo should be NO_OUTPUT.");
    assert(output.hasLocalChanges === false, "Clean empty repo should not have local changes.");
    assert(output.hasUnpushedCommits === false, "Clean empty repo should not have unpushed commits.");
    scenarioResults.push("Output status NO_OUTPUT");
  }

  {
    const repo = makeTempDir("mongi-dirty-output");
    initRepo(repo);
    fs.writeFileSync(path.join(repo, "work.txt"), "local work\n", "utf8");
    const output = getGitOutputStatus({ cwd: repo, now: new Date(), quietHoursActive: false });
    assert(output.outputStatus === OUTPUT_STATUSES.LOCAL_ONLY, "Dirty working tree should be LOCAL_ONLY.");
    assert(output.hasLocalChanges === true, "Dirty working tree should be detected.");
    scenarioResults.push("Output status LOCAL_ONLY from dirty working tree");
  }

  {
    const remote = makeTempDir("mongi-remote");
    const repo = makeTempDir("mongi-ahead-output");
    git(remote, ["init", "--bare"]);
    initRepo(repo);
    git(repo, ["remote", "add", "origin", remote]);
    commitFile(repo, "base.txt", "base\n", yesterdayIso());
    git(repo, ["push", "-u", "origin", "main"]);
    commitFile(repo, "ahead.txt", "ahead\n", yesterdayIso());
    const output = getGitOutputStatus({ cwd: repo, now: new Date(), quietHoursActive: false });
    assert(output.outputStatus === OUTPUT_STATUSES.LOCAL_ONLY, "Ahead commit should be LOCAL_ONLY.");
    assert(output.hasUnpushedCommits === true, "Ahead commit should be detected as unpushed.");
    scenarioResults.push("Output status LOCAL_ONLY from unpushed commit");
  }

  {
    const repo = makeTempDir("mongi-no-upstream-output");
    initRepo(repo);
    commitFile(repo, "local.txt", "local commit\n", yesterdayIso());
    const output = getGitOutputStatus({ cwd: repo, now: new Date(), quietHoursActive: false });
    assert(output.outputStatus === OUTPUT_STATUSES.LOCAL_ONLY, "Local commit without upstream should be LOCAL_ONLY.");
    assert(output.hasUnpushedCommits === true, "Local commit without upstream should be treated as unpushed.");
    assert(output.repository.upstream === null, "Missing upstream should be exposed.");
    scenarioResults.push("Output status LOCAL_ONLY from no upstream local commit");
  }

  {
    const remote = makeTempDir("mongi-shipped-remote");
    const repo = makeTempDir("mongi-shipped-output");
    git(remote, ["init", "--bare"]);
    initRepo(repo);
    git(repo, ["remote", "add", "origin", remote]);
    commitFile(repo, "ship.txt", "shipped\n", new Date().toISOString());
    git(repo, ["push", "-u", "origin", "main"]);
    const output = getGitOutputStatus({ cwd: repo, now: new Date(), quietHoursActive: false });
    assert(output.outputStatus === OUTPUT_STATUSES.SHIPPED, "Upstream commit from today should be SHIPPED.");
    assert(output.hasShippedToday === true, "Shipped-today evidence should be detected.");
    scenarioResults.push("Output status SHIPPED from upstream commit date");
  }

  {
    // Anti-keyword: a percent that lives next to "할인"/"discount" must not be picked up as usage.
    const parseResult = parseClaudeUsage({
      serviceKey: "claude",
      serviceName: "Claude",
      bodyText: "플랜 사용량 한도 Pro\n최대 30% 할인\n결제 안내",
      candidateLines: [
        "플랜 사용량 한도 Pro",
        "최대 30% 할인"
      ],
      domCandidates: [],
      accessibilityCandidates: [],
      error: null,
      loginState: { loginLikely: false, textLooksUsage: true },
      turnstileState: { turnstileLikely: false }
    });
    assert(parseResult.ok === false, "Anti-keyword Claude parse should not be marked ok.");
    assert(parseResult.remainingShortWindowPercent === null, "Promo percent should not become a Claude short remaining value.");
    assert(parseResult.remainingWeeklyPercent === null, "Promo percent should not become a Claude weekly remaining value.");
    assert(parseResult.usedShortWindowPercent === null, "Promo percent should not become a Claude short used value.");
    assert(parseResult.usedWeeklyPercent === null, "Promo percent should not become a Claude weekly used value.");
    scenarioResults.push("Claude promo/discount percent does not become usage");
  }

  {
    // Codex anti-keyword guard
    const parseResult = parseCodexUsage({
      serviceKey: "codex",
      serviceName: "Codex",
      bodyText: "프로모션\n사용량과 관련 없는 정보\n45% 쿠폰\n결제",
      candidateLines: [
        "프로모션",
        "45% 쿠폰"
      ],
      domCandidates: [],
      accessibilityCandidates: [],
      error: null,
      loginState: { loginLikely: false, textLooksUsage: true },
      turnstileState: { turnstileLikely: false }
    });
    assert(parseResult.ok === false, "Codex promo/coupon percent should not parse successfully.");
    assert(parseResult.remainingShortWindowPercent === null, "Codex coupon percent should not become short remaining.");
    assert(parseResult.remainingWeeklyPercent === null, "Codex coupon percent should not become weekly remaining.");
    scenarioResults.push("Codex coupon/discount percent does not become usage");
  }

  {
    // Missing usage must surface as unavailable, never as 100.
    const state = createDefaultState();
    const parseResult = parseClaudeUsage({
      serviceKey: "claude",
      serviceName: "Claude",
      bodyText: "Some unrelated marketing text with no usage hints.",
      candidateLines: [],
      domCandidates: [],
      accessibilityCandidates: [],
      error: null,
      loginState: { loginLikely: false, textLooksUsage: false },
      turnstileState: { turnstileLikely: false }
    });
    updateServiceState(state, parseResult);
    assert(parseResult.ok === false, "No-percent Claude page should not parse ok.");
    assert(state.services.claude.remainingShortWindowPercent === null, "Missing Claude short remaining must remain null, not 100.");
    assert(state.services.claude.remainingWeeklyPercent === null, "Missing Claude weekly remaining must remain null, not 100.");
    const usageLine = require("../src/notifications/messages").formatUsageLine({
      claude: state.services.claude
    });
    assert(usageLine === null, "Discord usage line should omit Claude when remaining values are missing.");
    scenarioResults.push("Missing Claude usage stays unavailable, not 100");
  }

  {
    const state = createDefaultState();
    state.services.codex.remainingShortWindowPercent = 85;
    state.services.codex.remainingWeeklyPercent = 51;
    state.services.codex.lastCheckedAt = "2026-05-27T10:00:00.000Z";
    state.services.codex.lastSuccessfulCheckedAt = "2026-05-27T10:00:00.000Z";
    updateServiceState(state, {
      serviceKey: "codex",
      ok: false,
      shortWindowPercent: null,
      weeklyPercent: null,
      rawShortWindowPercent: null,
      rawWeeklyPercent: null,
      rawShortWindowMeaning: "unknown",
      rawWeeklyPercentMeaning: "unknown",
      remainingShortWindowPercent: null,
      remainingWeeklyPercent: null,
      usedShortWindowPercent: null,
      usedWeeklyPercent: null,
      errorReason: "parser_low_confidence"
    });
    assert(state.services.codex.remainingShortWindowPercent === 85, "Failed parse should preserve previous short remaining.");
    assert(state.services.codex.remainingWeeklyPercent === 51, "Failed parse should preserve previous weekly remaining.");
    assert(state.services.codex.lastCheckedAt === "2026-05-27T10:00:00.000Z", "Failed parse must not advance lastCheckedAt.");
    assert(state.services.codex.lastSuccessfulCheckedAt === "2026-05-27T10:00:00.000Z", "Failed parse must not advance lastSuccessfulCheckedAt.");
    assert(Boolean(state.services.codex.lastAttemptedAt), "Failed parse should record lastAttemptedAt.");
    const usageLine = require("../src/notifications/messages").formatUsageLine({
      codex: state.services.codex
    });
    assert(usageLine === null, "Discord usage line should omit stale provider values.");
    scenarioResults.push("Failed parse preserves values but marks provider stale");
  }

  {
    const state = createDefaultState();
    state.services.codex.remainingShortWindowPercent = 85;
    state.services.codex.remainingWeeklyPercent = 51;
    state.sources.codex.usage = {
      remainingShortWindowPercent: 85,
      remainingWeeklyPercent: 51,
      usedShortWindowPercent: 15,
      usedWeeklyPercent: 49
    };
    state.sources.codex.lastFreshReadAt = "2026-05-28T00:00:00.000Z";
    updateServiceState(state, makeReadResult("codex", false).parseResult, {
      backend: "cdp",
      status: SOURCE_STATUSES.DEGRADED,
      freshness: FRESHNESS.STALE,
      lastRecoveryAction: "reload-threshold-not-met",
      lastError: "parser_low_confidence"
    });
    assert(state.services.codex.remainingShortWindowPercent === 85, "Read failure should preserve last known short usage.");
    assert(state.services.codex.remainingWeeklyPercent === 51, "Read failure should preserve last known weekly usage.");
    assert(state.sources.codex.freshness === FRESHNESS.STALE, "Read failure should mark source freshness stale.");
    assert(state.sources.codex.consecutiveFailures === 1, "Read failure should increment source consecutiveFailures.");
    scenarioResults.push("V3 last known usage is preserved with stale freshness");
  }

  {
    const service = { key: "codex", name: "Codex", parser: () => null };
    const calls = [];
    const reads = [
      makeReadResult("codex", false),
      makeReadResult("codex", false),
      makeReadResult("codex", false),
      makeReadResult("codex", true)
    ];
    const backend = createCdpBackend(service, {
      performRead: async (options) => {
        calls.push(options);
        return reads.shift();
      },
      listUsagePageCandidates: async () => [
        {
          index: 0,
          targetId: "new-codex-target",
          url: "https://chatgpt.com/codex/cloud/settings/analytics#usage",
          title: "Codex",
          matchType: "provider_url_pattern",
          score: 50
        }
      ],
      logger: { info: () => {}, warn: () => {}, error: () => {} }
    });
    const result = await backend.readUsage({
      context: {},
      sourceState: { consecutiveFailures: 2, lastReloadAt: null, usage: { remainingShortWindowPercent: 85 } },
      serviceState: makeServiceState({ remainingShortWindowPercent: 85 }),
      now: new Date("2026-05-28T01:00:00.000Z")
    });
    assert(result.parseResult.ok === true, "Reload success should return a successful parse result.");
    assert(calls.some((call) => call.reload === true), "Threshold failure should attempt reload.");
    assert(result.backend.lastRecoveryAction === "reload-success", "Reload success should record lastRecoveryAction.");
    assert(Boolean(result.backend.lastReloadAt), "Reload success should record lastReloadAt.");
    scenarioResults.push("V3 Codex threshold failure attempts reload and recovers");
  }

  {
    const service = { key: "claude", name: "Claude", parser: () => null };
    const calls = [];
    const reads = [
      makeReadResult("claude", false),
      makeReadResult("claude", false),
      makeReadResult("claude", false)
    ];
    const backend = createCdpBackend(service, {
      performRead: async (options) => {
        calls.push(options);
        return reads.shift();
      },
      listUsagePageCandidates: async () => [
        {
          index: 0,
          targetId: "claude-target",
          url: "https://claude.ai/settings/usage",
          title: "Claude",
          matchType: "provider_url_pattern",
          score: 50
        }
      ],
      logger: { info: () => {}, warn: () => {}, error: () => {} }
    });
    const result = await backend.readUsage({
      context: {},
      sourceState: {
        consecutiveFailures: 1,
        lastReloadAt: "2026-05-28T00:59:00.000Z",
        usage: { remainingShortWindowPercent: 70 }
      },
      serviceState: makeServiceState({ remainingShortWindowPercent: 70 }),
      now: new Date("2026-05-28T01:00:00.000Z")
    });
    assert(result.parseResult.ok === false, "Cooldown scenario should remain failed.");
    assert(!calls.some((call) => call.reload === true), "Reload cooldown should prevent another reload.");
    assert(result.backend.lastRecoveryAction === "reload-skipped-cooldown", "Cooldown skip should be recorded.");
    scenarioResults.push("V3 reload cooldown prevents duplicate reload");
  }

  {
    const service = { key: "codex", name: "Codex", parser: () => null };
    const calls = [];
    const rediscoveredSource = {
      selected: true,
      selectedTab: {
        targetId: "rediscovered-codex-target",
        url: "https://chatgpt.com/codex/cloud/settings/analytics#usage",
        title: "Codex Rediscovered",
        matchType: "provider_url_pattern"
      }
    };
    const reads = [
      makeReadResult("codex", false),
      makeReadResult("codex", false),
      makeReadResult("codex", true, { source: rediscoveredSource })
    ];
    const backend = createCdpBackend(service, {
      performRead: async (options) => {
        calls.push(options);
        return reads.shift();
      },
      listUsagePageCandidates: async () => [
        {
          index: 1,
          targetId: "rediscovered-codex-target",
          url: "https://chatgpt.com/codex/cloud/settings/analytics#usage",
          title: "Codex Rediscovered",
          matchType: "provider_url_pattern",
          score: 60
        }
      ],
      logger: { info: () => {}, warn: () => {}, error: () => {} }
    });
    const result = await backend.readUsage({
      context: {},
      sourceState: { consecutiveFailures: 0, lastReloadAt: null, usage: { remainingShortWindowPercent: 85 } },
      serviceState: makeServiceState({ remainingShortWindowPercent: 85 }),
      now: new Date("2026-05-28T01:00:00.000Z")
    });
    assert(result.parseResult.ok === true, "Target rediscovery read should recover.");
    assert(calls.some((call) => call.phase === "target-rediscovery"), "Target rediscovery should retry reading after rediscovery.");
    assert(result.backend.lastRecoveryAction === "target-rediscovery-success", "Rediscovery success should be recorded.");
    assert(result.backend.target.targetId === "rediscovered-codex-target", "Rediscovered target metadata should be recorded.");
    scenarioResults.push("V3 target rediscovery reconnects and retries read");
  }

  {
    const service = { key: "claude", name: "Claude", parser: () => null };
    const reads = [
      makeReadResult("claude", false, { errorReason: "usage_page_not_open", source: { selected: false, selectedTab: null } }),
      makeReadResult("claude", false, { errorReason: "usage_page_not_open", source: { selected: false, selectedTab: null } })
    ];
    const backend = createCdpBackend(service, {
      performRead: async () => reads.shift(),
      listUsagePageCandidates: async () => [],
      logger: { info: () => {}, warn: () => {}, error: () => {} }
    });
    const result = await backend.readUsage({
      context: {},
      sourceState: { consecutiveFailures: 1, lastReloadAt: null, usage: { remainingShortWindowPercent: 55 } },
      serviceState: makeServiceState({ remainingShortWindowPercent: 55 }),
      now: new Date("2026-05-28T01:00:00.000Z")
    });
    assert(result.parseResult.ok === false, "Missing target should not parse successfully.");
    assert(result.backend.status === SOURCE_STATUSES.MISSING, "Missing target should mark source status missing.");
    assert(result.backend.freshness === FRESHNESS.STALE, "Missing target with known value should keep stale freshness.");
    scenarioResults.push("V3 missing target records missing status and preserves stale value");
  }

  {
    const service = { key: "codex", name: "Codex", parser: () => null };
    const calls = [];
    const backend = createCdpBackend(service, {
      performRead: async (options) => {
        calls.push(options);
        return makeReadResult("codex", true);
      },
      logger: { info: () => {}, warn: () => {}, error: () => {} }
    });
    const result = await backend.readUsage({
      context: {},
      sourceState: { consecutiveFailures: 0, lastReloadAt: null, usage: { remainingShortWindowPercent: 80 } },
      serviceState: makeServiceState({ remainingShortWindowPercent: 80 }),
      now: new Date("2026-05-28T01:00:00.000Z"),
      forceReload: true
    });
    assert(result.parseResult.ok === true, "Manual reload should return a successful parse result.");
    assert(calls[0].reload === true, "Manual reload command should force a reload read.");
    assert(result.backend.lastRecoveryAction === "manual-reload-success", "Manual reload success should be recorded.");
    scenarioResults.push("V3 manual reload command forces source reload");
  }

  {
    const tempDir = makeTempDir("mongi-commands");
    const commandsFile = path.join(tempDir, "commands.json");
    const command = {
      id: "cmd-test",
      type: "reload-source",
      source: "claude",
      createdAt: "2026-05-28T00:00:00.000Z"
    };
    writeCommandStore({ version: 1, commands: [command] }, commandsFile);
    const store = readCommandStore(commandsFile);
    assert(pendingCommands(store).length === 1, "Command store should expose pending commands.");
    completeCommands(["cmd-test"], { status: "processed", result: "ok" }, commandsFile);
    const completed = readCommandStore(commandsFile);
    assert(pendingCommands(completed).length === 0, "Processed commands should not remain pending.");
    assert(completed.commands[0].processedAt, "Processed command should record processedAt.");
    fs.writeFileSync(commandsFile, "{broken", "utf8");
    const recovered = readCommandStore(commandsFile);
    assert(recovered.commands.length === 0, "Corrupt command store should recover to an empty command list.");
    assert(fs.readdirSync(tempDir).some((file) => file.startsWith("commands.json.corrupt.")), "Corrupt command store should be backed up.");
    scenarioResults.push("V3 command file supports pending, processed, and corrupt recovery states");
  }

  {
    const tempDir = makeTempDir("mongi-lock");
    const lockFile = path.join(tempDir, "monitor.lock");

    const fresh = acquireLock({ owner: "Mongi.app", mode: "loop" }, lockFile);
    assert(fresh.acquired, "Fresh lock should be acquired.");
    assert(readLock(lockFile).owner === "Mongi.app", "Lock should record owner.");

    // A live foreign holder blocks acquisition. pid 1 (launchd) is always alive on macOS.
    fs.writeFileSync(lockFile, JSON.stringify({ pid: 1, owner: "launchd", mode: "single", createdAt: new Date().toISOString() }));
    const blocked = acquireLock({ owner: "Mongi.app", mode: "loop" }, lockFile);
    assert(!blocked.acquired, "Lock held by a live process should block duplicates.");
    assert(blocked.holder.owner === "launchd", "Blocked acquire should report the current holder.");

    // A dead holder is treated as stale and replaced.
    fs.writeFileSync(lockFile, JSON.stringify({ pid: 999999, owner: "dead", mode: "loop", createdAt: new Date().toISOString() }));
    const replaced = acquireLock({ owner: "Mongi.app", mode: "loop" }, lockFile);
    assert(replaced.acquired && replaced.stale, "Stale lock from a dead process should be replaced.");

    const refreshed = refreshLock({ owner: "Mongi.app", mode: "loop" }, lockFile);
    assert(refreshed.acquired && readLock(lockFile).refreshedAt, "Refresh should keep ownership and mark freshness.");

    assert(releaseLock(process.pid, lockFile), "Owner should release its own lock.");
    assert(readLock(lockFile) === null, "Released lock file should be gone.");
    scenarioResults.push("V3 monitor lock acquires, blocks live duplicates, replaces stale, and releases");
  }

  {
    const tempDir = makeTempDir("mongi-runtime");
    const runtimeFile = path.join(tempDir, "runtime.json");

    recordMonitorRunning({ owner: "Mongi.app", mode: "loop", entrypoint: "/x/src/monitor.js", nodePath: "/usr/bin/node" }, runtimeFile);
    const running = computeMonitorStatus(readRuntimeMeta(runtimeFile));
    assert(running.effective === "running", "Live pid with fresh heartbeat should compute running.");
    assert(running.owner === "Mongi.app", "Computed status should expose owner.");

    recordMonitorHeartbeat({ owner: "Mongi.app" }, runtimeFile);
    const beat = readRuntimeMeta(runtimeFile);
    assert(beat.monitor.lastHeartbeatAt, "Heartbeat should record lastHeartbeatAt.");
    assert(beat.monitor.startedAt, "Heartbeat should preserve startedAt.");

    const crashedMeta = readRuntimeMeta(runtimeFile);
    crashedMeta.monitor.pid = 999999;
    assert(computeMonitorStatus(crashedMeta).effective === "crashed", "Dead pid with running status should compute crashed.");

    const staleMeta = readRuntimeMeta(runtimeFile);
    staleMeta.monitor.lastHeartbeatAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    assert(computeMonitorStatus(staleMeta).effective === "stale", "Old heartbeat with live pid should compute stale.");

    recordMonitorStopped({ owner: "Mongi.app" }, runtimeFile);
    const stopped = computeMonitorStatus(readRuntimeMeta(runtimeFile));
    assert(stopped.effective === "stopped", "Stopped monitor should compute stopped.");
    assert(stopped.pid === null, "Stopped monitor should clear pid.");
    scenarioResults.push("V3 runtime heartbeat tracks running, crashed, stale, and stopped states");
  }

  console.log(JSON.stringify({ ok: true, scenarios: scenarioResults }, null, 2));
}

main().catch((error) => {
  console.error(`[ERROR] Scenario tests failed: ${error.message}`);
  process.exit(1);
});
