const { loadConfig } = require("./config");
const logger = require("./utils/logger");
const { nowIso } = require("./utils/time");
const { loadState, saveState } = require("./state/stateStore");
const { applyInternalEventState, updateServiceState } = require("./state/serviceStateUpdater");
const { createServices } = require("./services");
const { extractUsagePage } = require("./extractors/usageExtractor");
const { closeBrowserResources, getBrowserContext } = require("./browser/browserContext");
const { detectCdpUnreachableEvent, detectEvents } = require("./events/eventDetector");
const { applyNotificationPatches, dispatchNotifications } = require("./notifications/notificationDispatcher");
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

async function runService(context, service) {
  const extraction = await extractUsagePage(context, service, {
    reuseExistingPages: true,
    openMissingPages: false,
    allowFocusSteal: false
  });
  const parseResult = service.parser(extraction);

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
    remainingShortWindowPercent: parseResult.remainingShortWindowPercent,
    remainingWeeklyPercent: parseResult.remainingWeeklyPercent,
    errorReason: parseResult.errorReason,
    navigationStatus: extraction.navigationStatus
  });

  return {
    extraction,
    parseResult
  };
}

async function main() {
  const baseConfig = loadConfig();
  const argvDryRun = process.argv.includes("--dry-run-notifications");
  const policyResult = loadPolicy({ strictJson: false });
  const config = configWithPolicy(baseConfig, policyResult.policy);
  const dryRun = config.dryRunNotifications || argvDryRun;

  if (dryRun) {
    logger.info("DRY RUN mode: Discord notifications will not be sent.");
  }
  const state = loadState(config);
  const services = createServices(config).filter((service) => serviceEnabled(config, service.key));
  const now = new Date();
  let browserResources;
  let context;
  const results = [];
  const events = [];

  for (const warning of policyResult.warnings) {
    logger.warn("Policy warning.", { warning });
  }

  try {
    browserResources = await getBrowserContext(config);
    context = browserResources.context;
  } catch (error) {
    logger.error(`Browser connection failed: ${error.message}`, error);
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
      const dispatchResults = await dispatchNotifications({ config, events, now, dryRun, logger });
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
        const result = await runService(context, service);
        const previousServiceState = clone(state.services[service.key]);
        updateServiceState(state, result.parseResult);
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
        updateServiceState(state, failedResult);
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
        dispatchResults = await dispatchNotifications({ config, events: dispatchableEvents, now, dryRun, logger });
        applyNotificationPatches(state, dispatchResults);
      } catch (error) {
        logger.error(`Notification dispatch failed: ${error.message}`, error);
      }
    }

    state.meta = state.meta || {};
    state.meta.lastMonitorRunAt = nowIso();
    saveState(config, state);

    logger.info("Monitor run completed.", {
      services: results.map((result) => ({
        serviceKey: result.serviceKey,
        ok: result.ok,
        parseMethod: result.parseMethod,
        parseConfidence: result.parseConfidence,
        remainingShortWindowPercent: result.remainingShortWindowPercent,
        remainingWeeklyPercent: result.remainingWeeklyPercent,
        errorReason: result.errorReason
      })),
      events: events.map((event) => ({
        type: event.type,
        serviceKey: event.serviceKey
      })),
      notificationsSent: dispatchResults.filter((result) => result.sent).length
    });
  } finally {
    await closeBrowserResources(browserResources);
  }

  return 0;
}

main()
  .then((exitCode) => {
    process.exit(exitCode || 0);
  })
  .catch((error) => {
    logger.error(`Monitor failed: ${error.message}`, error);
    process.exit(1);
  });
