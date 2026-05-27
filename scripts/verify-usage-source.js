const { loadConfig } = require("../src/config");
const { closeBrowserResources, getBrowserContext } = require("../src/browser/browserContext");
const { extractUsagePage, listUsagePageCandidates } = require("../src/extractors/usageExtractor");
const { findPercentCandidates, safeCandidateContext } = require("../src/parsers/common");
const { createServices } = require("../src/services");
const { buildStatus } = require("./status-json");

function normalizeCdpUrl(value) {
  return String(value || "").replace(/\/$/, "");
}

async function fetchCdpJson(config, path) {
  try {
    const response = await fetch(`${normalizeCdpUrl(config.chromeCdpUrl)}${path}`);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function summarizeTarget(target) {
  return {
    id: target.id || null,
    type: target.type || null,
    title: target.title || "",
    url: target.url || ""
  };
}

function candidatesForReport(extraction) {
  return findPercentCandidates(extraction)
    .map(safeCandidateContext)
    .filter(Boolean)
    .slice(0, 20);
}

function parserForReport(parseResult) {
  return {
    ok: parseResult.ok,
    parsedAt: parseResult.parsedAt,
    parseMethod: parseResult.parseMethod,
    parseConfidence: parseResult.parseConfidence,
    errorReason: parseResult.errorReason,
    rawShortWindowPercent: parseResult.rawShortWindowPercent,
    rawWeeklyPercent: parseResult.rawWeeklyPercent,
    rawShortWindowMeaning: parseResult.rawShortWindowMeaning,
    rawWeeklyPercentMeaning: parseResult.rawWeeklyPercentMeaning,
    remainingShortWindowPercent: parseResult.remainingShortWindowPercent,
    remainingWeeklyPercent: parseResult.remainingWeeklyPercent,
    usedShortWindowPercent: parseResult.usedShortWindowPercent,
    usedWeeklyPercent: parseResult.usedWeeklyPercent,
    selectedCandidates: parseResult.selectedCandidates
  };
}

function statusUsageForReport(status, serviceKey) {
  const usage = status && status.usage && status.usage[serviceKey];

  if (!usage) {
    return null;
  }

  return {
    shortRemaining: usage.shortRemaining,
    weeklyRemaining: usage.weeklyRemaining,
    shortUsed: usage.shortUsed,
    weeklyUsed: usage.weeklyUsed,
    failures: usage.failures,
    stale: usage.stale,
    lastCheckedAt: usage.lastCheckedAt,
    lastAttemptedAt: usage.lastAttemptedAt,
    lastSuccessfulCheckedAt: usage.lastSuccessfulCheckedAt,
    lastParseFailedAt: usage.lastParseFailedAt,
    lastParseFailureReason: usage.lastParseFailureReason,
    source: usage.source
  };
}

function valuesAgree(parseResult, statusUsage) {
  if (!parseResult.ok || !statusUsage || statusUsage.stale) {
    return false;
  }

  return parseResult.remainingShortWindowPercent === statusUsage.shortRemaining &&
    parseResult.remainingWeeklyPercent === statusUsage.weeklyRemaining &&
    parseResult.usedShortWindowPercent === statusUsage.shortUsed &&
    parseResult.usedWeeklyPercent === statusUsage.weeklyUsed;
}

async function main() {
  const config = loadConfig();
  const version = await fetchCdpJson(config, "/json/version");
  const targetList = await fetchCdpJson(config, "/json/list");
  const status = await buildStatus();
  const browserResources = await getBrowserContext(config);
  const context = browserResources.context;
  const services = createServices(config);
  const report = {
    generatedAt: new Date().toISOString(),
    cdp: {
      endpoint: config.chromeCdpUrl,
      connected: true,
      browser: version && version.Browser ? version.Browser : null,
      userDataDirConfigured: config.chromeUserDataDir,
      targets: Array.isArray(targetList) ? targetList.map(summarizeTarget) : []
    },
    providers: {}
  };

  try {
    for (const service of services) {
      const tabCandidates = await listUsagePageCandidates(context, service);
      const extraction = await extractUsagePage(context, service, {
        reuseExistingPages: true,
        openMissingPages: false,
        allowFocusSteal: false,
        reloadExistingPages: true
      });
      const parseResult = service.parser(extraction);
      const statusUsage = statusUsageForReport(status, service.key);

      report.providers[service.key] = {
        providerName: service.name,
        usageUrl: service.usageUrl,
        selectedSource: extraction.source,
        tabCandidates: tabCandidates.map((candidate) => ({
          index: candidate.index,
          targetId: candidate.targetId || null,
          url: candidate.url,
          title: candidate.title,
          matchType: candidate.matchType,
          score: candidate.score
        })),
        extraction: {
          extractedAt: extraction.extractedAt,
          finalUrl: extraction.finalUrl,
          navigationStatus: extraction.navigationStatus,
          loginState: extraction.loginState,
          turnstileState: extraction.turnstileState,
          error: extraction.error ? {
            reason: extraction.error.reason,
            message: extraction.error.message
          } : null
        },
        percentageCandidates: candidatesForReport(extraction),
        selectedValues: {
          shortRemaining: parseResult.remainingShortWindowPercent,
          weeklyRemaining: parseResult.remainingWeeklyPercent,
          shortUsed: parseResult.usedShortWindowPercent,
          weeklyUsed: parseResult.usedWeeklyPercent
        },
        parserOutput: parserForReport(parseResult),
        statusJson: statusUsage,
        comparison: {
          extractionMatchesStatusJson: valuesAgree(parseResult, statusUsage),
          statusJsonStale: statusUsage ? Boolean(statusUsage.stale) : true
        }
      };
    }
  } finally {
    await closeBrowserResources(browserResources);
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

main().catch((error) => {
  const config = loadConfig();
  const report = {
    generatedAt: new Date().toISOString(),
    cdp: {
      endpoint: config.chromeCdpUrl,
      connected: false
    },
    error: {
      reason: "usage_source_verification_failed",
      message: error.message
    }
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(1);
});
