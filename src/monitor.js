const path = require("path");
const { chromium } = require("playwright");

const { loadConfig } = require("./config");
const logger = require("./utils/logger");
const { nowIso } = require("./utils/time");
const { loadState, saveState } = require("./state/stateStore");
const { createServices } = require("./services");
const { extractUsagePage } = require("./extractors/usageExtractor");

const BROWSER_PROFILE_PATH = path.resolve("browser-profile");

function updateServiceState(state, parseResult) {
  const current = state.services[parseResult.serviceKey];
  const checkedAt = nowIso();

  if (!current) {
    return;
  }

  if (parseResult.ok) {
    const previousShort = current.shortWindowPercent;
    const previousWeekly = current.weeklyPercent;

    current.lastShortWindowPercent = previousShort;
    current.lastWeeklyPercent = previousWeekly;

    if (parseResult.shortWindowPercent !== null) {
      current.shortWindowPercent = parseResult.shortWindowPercent;
    }

    if (parseResult.weeklyPercent !== null) {
      current.weeklyPercent = parseResult.weeklyPercent;
    }

    current.lastCheckedAt = checkedAt;
    current.consecutiveParseFailures = 0;
    current.lastParseFailureAt = null;

    if (previousShort !== current.shortWindowPercent || previousWeekly !== current.weeklyPercent) {
      current.lastChangedAt = checkedAt;
    }

    return;
  }

  current.lastCheckedAt = checkedAt;
  current.consecutiveParseFailures = Number(current.consecutiveParseFailures || 0) + 1;
  current.lastParseFailureAt = checkedAt;
}

async function runService(context, service) {
  const extraction = await extractUsagePage(context, service);
  const parseResult = service.parser(extraction);

  logger.info(`${service.name} usage parse completed.`, {
    ok: parseResult.ok,
    parseMethod: parseResult.parseMethod,
    parseConfidence: parseResult.parseConfidence,
    shortWindowPercentFound: parseResult.shortWindowPercent !== null,
    weeklyPercentFound: parseResult.weeklyPercent !== null,
    errorReason: parseResult.errorReason,
    navigationStatus: extraction.navigationStatus
  });

  return {
    extraction,
    parseResult
  };
}

async function main() {
  const config = loadConfig();
  const state = loadState(config);
  const services = createServices(config);
  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_PATH, {
    headless: config.headless,
    viewport: { width: 1280, height: 900 }
  });
  const results = [];

  try {
    for (const service of services) {
      try {
        const result = await runService(context, service);
        updateServiceState(state, result.parseResult);
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

        updateServiceState(state, failedResult);
        results.push(failedResult);
        logger.error(`${service.name} monitor step failed.`, error);
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
        errorReason: result.errorReason
      }))
    });
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  logger.error(`Monitor failed: ${error.message}`, error);
  process.exitCode = 1;
});
