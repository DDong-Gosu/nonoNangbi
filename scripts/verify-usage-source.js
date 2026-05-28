const { loadConfig } = require("../src/config");
const { closeBrowserResources, getBrowserContext } = require("../src/browser/browserContext");
const { listUsagePageCandidates } = require("../src/extractors/usageExtractor");
const { findPercentCandidates, safeCandidateContext } = require("../src/parsers/common");
const { createServices } = require("../src/services");
const { loadState, saveState } = require("../src/state/stateStore");
const { updateServiceState } = require("../src/state/serviceStateUpdater");
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function stateUsageForReport(state, serviceKey) {
  const service = state && state.services && state.services[serviceKey];
  const source = state && state.sources && state.sources[serviceKey];

  return {
    service: service ? {
      remainingShortWindowPercent: service.remainingShortWindowPercent,
      remainingWeeklyPercent: service.remainingWeeklyPercent,
      usedShortWindowPercent: service.usedShortWindowPercent,
      usedWeeklyPercent: service.usedWeeklyPercent,
      lastAttemptedAt: service.lastAttemptedAt,
      lastSuccessfulCheckedAt: service.lastSuccessfulCheckedAt,
      lastParseFailedAt: service.lastParseFailedAt,
      lastParseFailureReason: service.lastParseFailureReason,
      consecutiveParseFailures: service.consecutiveParseFailures
    } : null,
    source: source ? {
      status: source.status,
      freshness: source.freshness,
      usage: source.usage,
      lastAttemptAt: source.lastAttemptAt,
      lastFreshReadAt: source.lastFreshReadAt,
      lastParseFailedAt: source.lastParseFailedAt,
      lastFailureAt: source.lastFailureAt,
      lastError: source.lastError,
      lastRecoveryAction: source.lastRecoveryAction,
      lastReloadAt: source.lastReloadAt,
      sourceReloadedAt: source.sourceReloadedAt,
      readAfterReload: source.readAfterReload,
      candidateCount: source.candidateCount,
      exactConfiguredUrlMatch: source.exactConfiguredUrlMatch,
      sourceUrlGuardPassed: source.sourceUrlGuardPassed,
      expectedUsageLabelsPresent: source.expectedUsageLabelsPresent,
      freshnessDecisionReason: source.freshnessDecisionReason,
      target: source.target
    } : null
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
    stale: usage.stale,
    freshness: usage.freshness,
    status: usage.status,
    lastFreshReadAt: usage.lastFreshReadAt,
    lastAttemptAt: usage.lastAttemptAt,
    lastParseFailedAt: usage.lastParseFailedAt,
    freshnessDecisionReason: usage.freshnessDecisionReason,
    exactConfiguredUrlMatch: usage.exactConfiguredUrlMatch,
    candidateCount: usage.candidateCount,
    target: usage.target
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
  const browserResources = await getBrowserContext(config);
  const context = browserResources.context;
  const services = createServices(config);
  const state = loadState(config);
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
      const before = stateUsageForReport(clone(state), service.key);
      const tabCandidates = await listUsagePageCandidates(context, service);
      const backend = service.createBackend(service);
      const readResult = await backend.readUsage({
        context,
        sourceState: state.sources && state.sources[service.key],
        serviceState: state.services && state.services[service.key],
        now: new Date(),
        forceReload: true
      });
      const parserOutput = service.parser(readResult.extraction);

      updateServiceState(state, readResult.parseResult, readResult.backend);

      const after = stateUsageForReport(clone(state), service.key);

      report.providers[service.key] = {
        providerName: service.name,
        configuredUrl: service.usageUrl,
        candidateCount: tabCandidates.length,
        tabCandidates: tabCandidates.map((candidate) => ({
          index: candidate.index,
          targetId: candidate.targetId || null,
          url: candidate.url,
          title: candidate.title,
          matchType: candidate.matchType,
          exactConfiguredUrlMatch: Boolean(candidate.exactConfiguredUrlMatch),
          sourceUrlGuardPassed: Boolean(candidate.sourceUrlGuardPassed),
          score: candidate.score
        })),
        selectedSource: readResult.extraction.source,
        selectedTarget: readResult.backend && readResult.backend.target || null,
        exactConfiguredUrlMatch: Boolean(readResult.backend && readResult.backend.exactConfiguredUrlMatch),
        sourceUrlGuardPassed: Boolean(readResult.backend && readResult.backend.sourceUrlGuardPassed),
        reload: {
          performed: Boolean(readResult.backend && readResult.backend.readAfterReload),
          sourceReloadedAt: readResult.backend && readResult.backend.sourceReloadedAt || null,
          lastReloadAt: readResult.backend && readResult.backend.lastReloadAt || null,
          waitDurationMs: service.key === "claude" ? 9000 : 6000
        },
        extraction: {
          extractedAt: readResult.extraction.extractedAt,
          finalUrl: readResult.extraction.finalUrl,
          navigationStatus: readResult.extraction.navigationStatus,
          extractedTextLength: String(readResult.extraction.bodyText || "").length,
          expectedUsageLabelsPresent: Boolean(readResult.extraction.expectedUsageLabelsPresent),
          loginState: readResult.extraction.loginState,
          turnstileState: readResult.extraction.turnstileState,
          error: readResult.extraction.error ? {
            reason: readResult.extraction.error.reason,
            message: readResult.extraction.error.message
          } : null
        },
        safeUsageContext: candidatesForReport(readResult.extraction),
        parserOutput: parserForReport(parserOutput),
        normalizedOutput: parserForReport(readResult.parseResult),
        stateBefore: before,
        stateAfter: after,
        freshnessDecision: {
          status: readResult.backend && readResult.backend.status,
          freshness: readResult.backend && readResult.backend.freshness,
          reason: readResult.backend && readResult.backend.freshnessDecisionReason,
          lastError: readResult.backend && readResult.backend.lastError
        }
      };
    }

    saveState(config, state);

    const status = await buildStatus();

    for (const service of services) {
      const provider = report.providers[service.key];
      const statusUsage = statusUsageForReport(status, service.key);

      provider.statusJson = statusUsage;
      provider.comparison = {
        verifyMatchesStatusJson: valuesAgree({
          ok: provider.normalizedOutput.ok,
          remainingShortWindowPercent: provider.normalizedOutput.remainingShortWindowPercent,
          remainingWeeklyPercent: provider.normalizedOutput.remainingWeeklyPercent,
          usedShortWindowPercent: provider.normalizedOutput.usedShortWindowPercent,
          usedWeeklyPercent: provider.normalizedOutput.usedWeeklyPercent
        }, statusUsage),
        statusJsonStale: statusUsage ? Boolean(statusUsage.stale) : true,
        statusFreshnessReason: statusUsage && statusUsage.freshnessDecisionReason || null
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
