const { loadConfig } = require("./config");
const logger = require("./utils/logger");
const { ensureRuntimeDirs } = require("./runtime/paths");
const { completeCommands, pendingCommands, readCommandStore } = require("./runtime/commandStore");
const {
  recordMonitorRunning,
  recordMonitorHeartbeat,
  recordMonitorStopped
} = require("./runtime/runtimeMeta");
const { acquireLock, refreshLock, releaseLock } = require("./runtime/monitorLock");
const { nowIso } = require("./utils/time");
const { loadState, saveState } = require("./state/stateStore");
const { applyInternalEventState, updateServiceState } = require("./state/serviceStateUpdater");
const { createServices } = require("./services");
const { BACKEND_IDS, FRESHNESS, SOURCE_STATUSES } = require("./backends/usageBackend");
const { closeBrowserResources, getBrowserContext } = require("./browser/browserContext");
const { detectCdpUnreachableEvent, detectEvents, isQuietHours } = require("./events/eventDetector");
const { applyNotificationPatches, dispatchNotifications } = require("./notifications/notificationDispatcher");
const { getGitOutputStatus } = require("./output/gitOutputStatus");
const { loadPolicy } = require("./policy/policyStore");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function configWithPolicy(config, policy) {
  return {
    ...config,
    idleMinutesBeforeSummary: policy.thresholds.sessionStoppedMinutes,
    weeklyFullReminderHours: policy.thresholds.weeklyIdleReminderHours,
    diagnosticReminderHours: policy.thresholds.diagnosticReminderHours,
    quietHours: {
      enabled: policy.quietHours.enabled,
      startHour: policy.quietHours.startHour,
      endHour: policy.quietHours.endHour
    },
    policy
  };
}

function serviceEnabled(config, serviceKey) {
  const servicePolicy = config.policy && config.policy.services && config.policy.services[serviceKey];
  return !servicePolicy || servicePolicy.enabled !== false;
}

function usageSnapshot(state) {
  return {
    codex: state.services && state.services.codex,
    claude: state.services && state.services.claude
  };
}

function serviceHasUsage(serviceState) {
  return Boolean(serviceState && (
    serviceState.remainingShortWindowPercent !== null ||
    serviceState.remainingWeeklyPercent !== null ||
    serviceState.usedShortWindowPercent !== null ||
    serviceState.usedWeeklyPercent !== null
  ));
}

async function runService(context, service, state, options = {}) {
  const backend = service.createBackend(service);
  const result = await backend.readUsage({
    context,
    sourceState: state.sources && state.sources[service.key],
    serviceState: state.services && state.services[service.key],
    now: new Date(),
    forceReload: options.forceReload === true
  });
  const extraction = result.extraction;
  const parseResult = result.parseResult;

  if (parseResult.errorReason === "turnstile_verification_required") {
    logger.warn(`${service.name} requires Turnstile verification. Open normal Chrome through CDP, pass verification manually, then rerun monitor.`);
  }

  if (parseResult.errorReason === "usage_page_not_open") {
    logger.warn(`${service.name} usage page is not open. Scheduled monitor will not open new tabs; run Mongi starter and confirm the usage page is visible.`);
  }

  logger.info(`${service.name} usage parse completed.`, {
    ok: parseResult.ok,
    parseMethod: parseResult.parseMethod,
    parseConfidence: parseResult.parseConfidence,
    shortWindowPercentFound: parseResult.shortWindowPercent !== null,
    weeklyPercentFound: parseResult.weeklyPercent !== null,
    rawShortWindowMeaning: parseResult.rawShortWindowMeaning,
    rawWeeklyPercentMeaning: parseResult.rawWeeklyPercentMeaning,
    remainingShortWindowPercent: parseResult.remainingShortWindowPercent,
    remainingWeeklyPercent: parseResult.remainingWeeklyPercent,
    usedShortWindowPercent: parseResult.usedShortWindowPercent,
    usedWeeklyPercent: parseResult.usedWeeklyPercent,
    errorReason: parseResult.errorReason,
    navigationStatus: extraction.navigationStatus,
    source: extraction.source,
    backend: result.backend && result.backend.backend,
    sourceStatus: result.backend && result.backend.status,
    freshness: result.backend && result.backend.freshness,
    lastRecoveryAction: result.backend && result.backend.lastRecoveryAction
  });

  return {
    extraction,
    parseResult,
    backend: result.backend
  };
}

async function runMonitorCycle() {
  const baseConfig = loadConfig();
  const argvDryRun = process.argv.includes("--dry-run-notifications");
  const argvForceReload = process.argv.includes("--force-reload");
  const policyResult = loadPolicy({ strictJson: false });
  const config = configWithPolicy(baseConfig, policyResult.policy);
  const dryRun = config.dryRunNotifications || argvDryRun;

  if (dryRun) {
    logger.info("DRY RUN mode: Discord notifications will not be sent.");
  }
  const state = loadState(config);
  const services = createServices(config).filter((service) => serviceEnabled(config, service.key));
  const now = new Date();
  const outputCwd = process.env.MONGI_OUTPUT_CWD && process.env.MONGI_OUTPUT_CWD.trim().length > 0
    ? process.env.MONGI_OUTPUT_CWD.trim()
    : process.cwd();
  const outputStatus = getGitOutputStatus({
    cwd: outputCwd,
    now,
    quietHoursActive: isQuietHours(config, now)
  });
  let browserResources;
  let context;
  const results = [];
  const events = [];
  const commandStore = readCommandStore(undefined, logger);
  const commands = pendingCommands(commandStore);
  const commandIds = commands.map((command) => command.id);
  const manualReloadSources = new Set(commands
    .filter((command) => command.type === "reload-source" && command.source)
    .map((command) => command.source));
  const reconnectRequested = commands.some((command) => command.type === "reconnect-browser");
  const refreshRequested = commands.some((command) => command.type === "refresh-now") || argvForceReload;
  const healthRequested = commands.some((command) => command.type === "run-health-check");

  for (const warning of policyResult.warnings) {
    logger.warn("Policy warning.", { warning });
  }

  if (commands.length > 0) {
    logger.info("Pending commands loaded.", {
      count: commands.length,
      types: commands.map((command) => command.type),
      reloadSources: Array.from(manualReloadSources),
      reconnectRequested,
      refreshRequested,
      healthRequested
    });
  }

  state.output = outputStatus;
  logger.info("Git output status classified.", {
    outputStatus: outputStatus.outputStatus,
    reason: outputStatus.reason,
    repositoryAvailable: outputStatus.repository.available,
    branch: outputStatus.repository.branch,
    upstream: outputStatus.repository.upstream,
    hasLocalChanges: outputStatus.hasLocalChanges,
    hasUnpushedCommits: outputStatus.hasUnpushedCommits,
    hasShippedToday: outputStatus.hasShippedToday,
    quietHoursActive: outputStatus.quietHoursActive,
    shippedDetectionLimitation: outputStatus.details.shippedDetectionLimitation
  });

  try {
    browserResources = await getBrowserContext(config);
    context = browserResources.context;
  } catch (error) {
    logger.error(`Browser connection failed: ${error.message}`, error);

    for (const service of services) {
      updateServiceState(state, {
        serviceKey: service.key,
        serviceName: service.name,
        ok: false,
        shortWindowPercent: null,
        weeklyPercent: null,
        parseMethod: "cdp_connection",
        parseConfidence: "none",
        rawTextSample: "",
        parsedAt: nowIso(),
        errorReason: "cdp_unreachable"
      }, {
        backend: BACKEND_IDS.CDP,
        status: serviceHasUsage(state.services && state.services[service.key]) ? SOURCE_STATUSES.STALE : SOURCE_STATUSES.FAILED,
        freshness: serviceHasUsage(state.services && state.services[service.key]) ? FRESHNESS.STALE : FRESHNESS.UNKNOWN,
        lastRecoveryAction: "cdp-unreachable",
        lastError: "cdp_unreachable",
        target: null
      });
    }

    const cdpEvent = detectCdpUnreachableEvent({
      state,
      config,
      now,
      errorReason: "cdp_unreachable"
    });

    if (cdpEvent) {
      events.push(cdpEvent);
    }

    try {
      const dispatchResults = await dispatchNotifications({ config, events, now, dryRun, logger, output: outputStatus, usage: usageSnapshot(state) });
      applyNotificationPatches(state, dispatchResults);
    } catch (dispatchError) {
      logger.error(`Diagnostic notification failed: ${dispatchError.message}`, dispatchError);
    }

    state.meta = state.meta || {};
    state.meta.lastMonitorRunAt = now.toISOString();
    saveState(config, state);
    return 1;
  }

  logger.info("Browser context ready for monitor.", {
    mode: browserResources.mode,
    cdpUrl: browserResources.mode === "cdp" ? browserResources.cdpUrl : undefined
  });

  try {
    for (const service of services) {
      try {
        const result = await runService(context, service, state, {
          forceReload: refreshRequested || manualReloadSources.has(service.key)
        });
        const previousServiceState = clone(state.services[service.key]);
        updateServiceState(state, result.parseResult, result.backend);
        const serviceEvents = detectEvents({
          previousServiceState,
          currentServiceState: state.services[service.key],
          service,
          config,
          now,
          parseSucceeded: result.parseResult.ok
        });
        applyInternalEventState(state, serviceEvents, now);
        events.push(...serviceEvents);
        results.push(result.parseResult);
      } catch (error) {
        const failedResult = {
          serviceKey: service.key,
          serviceName: service.name,
          ok: false,
          shortWindowPercent: null,
          weeklyPercent: null,
          parseMethod: "monitor",
          parseConfidence: "none",
          rawTextSample: "",
          parsedAt: nowIso(),
          errorReason: "unknown_page_structure"
        };

        const previousServiceState = clone(state.services[service.key]);
        updateServiceState(state, failedResult, {
          backend: BACKEND_IDS.CDP,
          status: serviceHasUsage(state.services && state.services[service.key]) ? SOURCE_STATUSES.STALE : SOURCE_STATUSES.FAILED,
          freshness: serviceHasUsage(state.services && state.services[service.key]) ? FRESHNESS.STALE : FRESHNESS.UNKNOWN,
          lastRecoveryAction: "monitor-step-failed",
          lastError: failedResult.errorReason,
          target: null
        });
        const serviceEvents = detectEvents({
          previousServiceState,
          currentServiceState: state.services[service.key],
          service,
          config,
          now,
          parseSucceeded: false
        });
        events.push(...serviceEvents);
        results.push(failedResult);
        logger.error(`${service.name} monitor step failed.`, error);
      }
    }

    const dispatchableEvents = events.filter((event) => event.type !== "usage_active");
    let dispatchResults = [];

    if (dispatchableEvents.length > 0) {
      try {
        dispatchResults = await dispatchNotifications({ config, events: dispatchableEvents, now, dryRun, logger, output: outputStatus, usage: usageSnapshot(state) });
        applyNotificationPatches(state, dispatchResults);
      } catch (error) {
        logger.error(`Notification dispatch failed: ${error.message}`, error);
      }
    }

    state.meta = state.meta || {};
    state.meta.lastMonitorRunAt = nowIso();
    saveState(config, state);

    try {
      recordMonitorHeartbeat();
    } catch (error) {
      logger.warn("Failed to update runtime heartbeat.", error);
    }

    logger.info("Monitor run completed.", {
      output: {
        outputStatus: outputStatus.outputStatus,
        reason: outputStatus.reason,
        hasLocalChanges: outputStatus.hasLocalChanges,
        hasUnpushedCommits: outputStatus.hasUnpushedCommits,
        hasShippedToday: outputStatus.hasShippedToday,
        quietHoursActive: outputStatus.quietHoursActive
      },
      services: results.map((result) => ({
        serviceKey: result.serviceKey,
        ok: result.ok,
        parseMethod: result.parseMethod,
        parseConfidence: result.parseConfidence,
        rawShortWindowMeaning: result.rawShortWindowMeaning,
        rawWeeklyPercentMeaning: result.rawWeeklyPercentMeaning,
        remainingShortWindowPercent: result.remainingShortWindowPercent,
        remainingWeeklyPercent: result.remainingWeeklyPercent,
        usedShortWindowPercent: result.usedShortWindowPercent,
        usedWeeklyPercent: result.usedWeeklyPercent,
        errorReason: result.errorReason
      })),
      sources: Object.entries(state.sources || {}).map(([sourceKey, sourceState]) => ({
        sourceKey,
        backend: sourceState.backend,
        status: sourceState.status,
        freshness: sourceState.freshness,
        consecutiveFailures: sourceState.consecutiveFailures,
        lastRecoveryAction: sourceState.lastRecoveryAction,
        lastReloadAt: sourceState.lastReloadAt
      })),
      events: events.map((event) => ({
        type: event.type,
        serviceKey: event.serviceKey
      })),
      notificationsSent: dispatchResults.filter((result) => result.sent).length
    });

    try {
      completeCommands(commandIds, { status: "processed", result: "processed by monitor" }, undefined, logger);
    } catch (error) {
      logger.warn("Failed to mark commands processed.", { error: error.message });
    }
  } finally {
    await closeBrowserResources(browserResources);
  }

  return 0;
}

function envInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveOwner(loopMode) {
  const raw = process.env.MONGI_MONITOR_OWNER;
  if (raw && raw.trim().length > 0) {
    return raw.trim();
  }
  return loopMode ? "monitor" : "cli";
}

function monitorMetaFromEnv() {
  const meta = {};
  if (process.env.MONGI_MONITOR_ENTRYPOINT) {
    meta.entrypoint = process.env.MONGI_MONITOR_ENTRYPOINT;
  } else {
    meta.entrypoint = __filename;
  }
  if (process.env.MONGI_MONITOR_NODE_PATH) {
    meta.nodePath = process.env.MONGI_MONITOR_NODE_PATH;
  } else {
    meta.nodePath = process.execPath;
  }
  return meta;
}

// Long-lived monitor: polls on an interval and keeps runtime.json heartbeat
// fresh between polls. Holds the lock for its whole lifetime so duplicate
// launches (e.g. the app starting twice) become no-ops. Cleans up on signals.
function runLoop({ owner, mode, entrypoint, nodePath }) {
  return new Promise((resolve) => {
    const heartbeatMs = envInt("MONGI_MONITOR_HEARTBEAT_INTERVAL_MS", 30 * 1000);
    const pollMs = envInt("MONGI_MONITOR_POLL_INTERVAL_MS", 10 * 60 * 1000);
    let stopping = false;
    let cycleTimer = null;
    let cycleRunning = false;

    recordMonitorRunning({ owner, mode, entrypoint, nodePath });
    logger.info("Monitor loop started.", { owner, pollMs, heartbeatMs, pid: process.pid });

    const heartbeat = setInterval(() => {
      try {
        recordMonitorHeartbeat({ owner });
        refreshLock({ owner, mode });
      } catch (error) {
        logger.warn("Failed to update runtime heartbeat in loop.", { error: error.message });
      }
    }, heartbeatMs);

    const tick = async () => {
      if (stopping || cycleRunning) {
        return;
      }
      cycleRunning = true;
      try {
        await runMonitorCycle();
      } catch (error) {
        logger.error(`Monitor loop cycle failed: ${error.message}`, error);
      } finally {
        cycleRunning = false;
        try {
          recordMonitorHeartbeat({ owner });
        } catch (error) {
          logger.warn("Failed to record heartbeat after cycle.", { error: error.message });
        }
        if (!stopping) {
          cycleTimer = setTimeout(tick, pollMs);
        }
      }
    };

    const shutdown = (signal) => {
      if (stopping) {
        return;
      }
      stopping = true;
      clearInterval(heartbeat);
      if (cycleTimer) {
        clearTimeout(cycleTimer);
      }
      try {
        recordMonitorStopped({ owner });
      } catch (error) {
        logger.warn("Failed to record monitor stopped.", { error: error.message });
      }
      try {
        releaseLock(process.pid);
      } catch (error) {
        logger.warn("Failed to release monitor lock.", { error: error.message });
      }
      logger.info("Monitor loop stopped.", { signal, pid: process.pid });
      resolve(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    tick();
  });
}

async function main() {
  try {
    ensureRuntimeDirs();
  } catch (error) {
    process.stderr.write(`Failed to prepare runtime directories: ${error.message}\n`);
  }

  const loopMode = process.argv.includes("--loop")
    || ["1", "true", "yes"].includes(String(process.env.MONGI_MONITOR_LOOP || "").toLowerCase());
  const owner = resolveOwner(loopMode);
  const mode = loopMode ? "loop" : "single";
  const { entrypoint, nodePath } = monitorMetaFromEnv();
  const forceReloadOnce = !loopMode && process.argv.includes("--force-reload");

  const lock = acquireLock({ owner, mode });
  if (!lock.acquired) {
    logger.warn("Another monitor already holds the lock; skipping this run.", {
      requestedOwner: owner,
      requestedMode: mode,
      holderPid: lock.holder && lock.holder.pid,
      holderOwner: lock.holder && lock.holder.owner,
      holderMode: lock.holder && lock.holder.mode
    });

    if (forceReloadOnce) {
      logger.warn("Force reload requested; running one reload-read cycle without taking monitor ownership.", {
        holderPid: lock.holder && lock.holder.pid,
        holderOwner: lock.holder && lock.holder.owner,
        holderMode: lock.holder && lock.holder.mode
      });
      return runMonitorCycle();
    }

    return 0;
  }

  if (lock.stale && lock.previousHolder) {
    logger.warn("Replaced a stale monitor lock from a dead process.", {
      previousPid: lock.previousHolder.pid,
      previousOwner: lock.previousHolder.owner
    });
  }

  if (loopMode) {
    return runLoop({ owner, mode, entrypoint, nodePath });
  }

  try {
    recordMonitorRunning({ owner, mode, entrypoint, nodePath });
    const exitCode = await runMonitorCycle();
    recordMonitorStopped({ owner });
    return exitCode;
  } finally {
    releaseLock(process.pid);
  }
}

main()
  .then((exitCode) => {
    process.exit(exitCode || 0);
  })
  .catch((error) => {
    logger.error(`Monitor failed: ${error.message}`, error);
    try {
      recordMonitorStopped({ error: error.message });
    } catch {
      // best effort
    }
    try {
      releaseLock(process.pid);
    } catch {
      // best effort
    }
    process.exit(1);
  });
