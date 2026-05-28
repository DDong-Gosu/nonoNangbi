const logger = require("../utils/logger");
const { extractUsagePage, listUsagePageCandidates, selectUsagePageCandidate } = require("../extractors/usageExtractor");
const { BACKEND_IDS, FRESHNESS, SOURCE_STATUSES, createBackendDiagnostics } = require("./usageBackend");

const DEFAULT_RELOAD_POLICY = {
  thresholds: {
    codex: 3,
    claude: 2
  },
  minReloadIntervalMs: 5 * 60 * 1000,
  waitAfterReloadMs: {
    codex: 6000,
    claude: 9000
  }
};

const reloadingSources = new Set();

function hasKnownUsage(sourceState, serviceState) {
  const usage = sourceState && sourceState.usage;

  if (usage && (
    usage.remainingShortWindowPercent !== null ||
    usage.remainingWeeklyPercent !== null ||
    usage.usedShortWindowPercent !== null ||
    usage.usedWeeklyPercent !== null
  )) {
    return true;
  }

  return Boolean(serviceState && (
    serviceState.remainingShortWindowPercent !== null ||
    serviceState.remainingWeeklyPercent !== null ||
    serviceState.usedShortWindowPercent !== null ||
    serviceState.usedWeeklyPercent !== null
  ));
}

function sourceTargetFromExtraction(extraction) {
  const source = extraction && extraction.source;
  const selectedTab = source && source.selectedTab;

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

function failureFreshness(sourceState, serviceState) {
  return hasKnownUsage(sourceState, serviceState) ? FRESHNESS.STALE : FRESHNESS.UNKNOWN;
}

function failureStatus(projectedFailures, sourceState, serviceState) {
  if (!hasKnownUsage(sourceState, serviceState)) {
    return SOURCE_STATUSES.FAILED;
  }

  return projectedFailures <= 1 ? SOURCE_STATUSES.DEGRADED : SOURCE_STATUSES.STALE;
}

function millisSince(value, now) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return now.getTime() - parsed.getTime();
}

function cooldownRemainingMs(sourceState, now, policy = DEFAULT_RELOAD_POLICY) {
  const elapsed = millisSince(sourceState && sourceState.lastReloadAt, now);

  if (elapsed === null) {
    return 0;
  }

  return Math.max(0, policy.minReloadIntervalMs - elapsed);
}

function shouldAttemptReload({ serviceKey, projectedFailures, sourceState, now = new Date(), policy = DEFAULT_RELOAD_POLICY }) {
  const threshold = policy.thresholds[serviceKey] || 3;
  const cooldownMs = cooldownRemainingMs(sourceState, now, policy);

  return {
    allowed: projectedFailures >= threshold && cooldownMs === 0 && !reloadingSources.has(serviceKey),
    threshold,
    cooldownMs,
    reloading: reloadingSources.has(serviceKey)
  };
}

function buildFailureDiagnostics({ service, parseResult, extraction, projectedFailures, sourceState, serviceState, status, freshness, action, lastReloadAt, lastError }) {
  return createBackendDiagnostics({
    backend: BACKEND_IDS.CDP,
    status: status || failureStatus(projectedFailures, sourceState, serviceState),
    freshness: freshness || failureFreshness(sourceState, serviceState),
    lastRecoveryAction: action || null,
    lastReloadAt: lastReloadAt || null,
    lastError: lastError || parseResult.errorReason || (extraction && extraction.error && extraction.error.reason) || "read_failed",
    target: sourceTargetFromExtraction(extraction),
    projectedFailures,
    source: service.key
  });
}

function buildSuccessDiagnostics({ service, parseResult, extraction, action, lastReloadAt }) {
  return createBackendDiagnostics({
    backend: BACKEND_IDS.CDP,
    status: SOURCE_STATUSES.HEALTHY,
    freshness: FRESHNESS.FRESH,
    lastRecoveryAction: action || null,
    lastReloadAt: lastReloadAt || null,
    lastError: null,
    target: sourceTargetFromExtraction(extraction),
    source: service.key,
    parseMethod: parseResult.parseMethod,
    parseConfidence: parseResult.parseConfidence
  });
}

function createCdpBackend(service, options = {}) {
  const dependencies = {
    extractUsagePage: options.extractUsagePage || extractUsagePage,
    listUsagePageCandidates: options.listUsagePageCandidates || listUsagePageCandidates,
    selectUsagePageCandidate: options.selectUsagePageCandidate || selectUsagePageCandidate,
    logger: options.logger || logger,
    policy: {
      ...DEFAULT_RELOAD_POLICY,
      ...(options.policy || {}),
      thresholds: {
        ...DEFAULT_RELOAD_POLICY.thresholds,
        ...((options.policy && options.policy.thresholds) || {})
      },
      waitAfterReloadMs: {
        ...DEFAULT_RELOAD_POLICY.waitAfterReloadMs,
        ...((options.policy && options.policy.waitAfterReloadMs) || {})
      }
    }
  };

  async function performRead(context, readOptions = {}) {
    if (options.performRead) {
      return options.performRead(readOptions);
    }

    const extraction = await dependencies.extractUsagePage(context, service, {
      reuseExistingPages: true,
      openMissingPages: false,
      allowFocusSteal: false,
      reloadExistingPages: readOptions.reload === true,
      postReloadWaitMs: readOptions.postReloadWaitMs || 0
    });
    const parseResult = service.parser(extraction);

    return {
      extraction,
      parseResult
    };
  }

  async function rediscoverTarget(context) {
    dependencies.logger.info(`${service.name} target rediscovery start.`, {
      serviceKey: service.key,
      backend: BACKEND_IDS.CDP
    });

    const candidates = await dependencies.listUsagePageCandidates(context, service);
    const selected = dependencies.selectUsagePageCandidate(candidates);

    if (!selected) {
      dependencies.logger.warn(`${service.name} target rediscovery failed.`, {
        serviceKey: service.key,
        backend: BACKEND_IDS.CDP,
        candidateCount: Array.isArray(candidates) ? candidates.length : 0
      });
      return null;
    }

    dependencies.logger.info(`${service.name} target rediscovery success.`, {
      serviceKey: service.key,
      backend: BACKEND_IDS.CDP,
      targetId: selected.targetId || null,
      url: selected.url || "",
      title: selected.title || "",
      matchType: selected.matchType || "unknown"
    });

    return selected;
  }

  async function readUsage({ context, sourceState, serviceState, now = new Date(), forceReload = false }) {
    const projectedFailures = Number((sourceState && sourceState.consecutiveFailures) || (serviceState && serviceState.consecutiveParseFailures) || 0) + 1;

    if (forceReload) {
      const reloadAt = now.toISOString();

      if (reloadingSources.has(service.key)) {
        const skippedParseResult = {
          serviceKey: service.key,
          serviceName: service.name,
          ok: false,
          shortWindowPercent: null,
          weeklyPercent: null,
          parseMethod: "manual_reload",
          parseConfidence: "none",
          rawTextSample: "",
          parsedAt: now.toISOString(),
          errorReason: "manual_reload_in_progress"
        };
        return {
          extraction: {
            serviceKey: service.key,
            serviceName: service.name,
            navigationStatus: null,
            source: null,
            error: { reason: "manual_reload_in_progress" }
          },
          parseResult: skippedParseResult,
          backend: buildFailureDiagnostics({
            service,
            parseResult: skippedParseResult,
            extraction: null,
            projectedFailures,
            sourceState,
            serviceState,
            status: failureStatus(projectedFailures, sourceState, serviceState),
            freshness: failureFreshness(sourceState, serviceState),
            action: "manual-reload-skipped-in-progress",
            lastError: "manual_reload_in_progress"
          })
        };
      }

      reloadingSources.add(service.key);
      dependencies.logger.warn(`${service.name} manual reload start.`, {
        serviceKey: service.key,
        backend: BACKEND_IDS.CDP
      });

      try {
        const reloaded = await performRead(context, {
          phase: "manual-reload",
          reload: true,
          postReloadWaitMs: dependencies.policy.waitAfterReloadMs[service.key] || 7000
        });

        if (reloaded.parseResult.ok) {
          dependencies.logger.info(`${service.name} manual reload success.`, {
            serviceKey: service.key,
            backend: BACKEND_IDS.CDP,
            parseMethod: reloaded.parseResult.parseMethod,
            parseConfidence: reloaded.parseResult.parseConfidence
          });
          return {
            ...reloaded,
            backend: buildSuccessDiagnostics({
              service,
              parseResult: reloaded.parseResult,
              extraction: reloaded.extraction,
              action: "manual-reload-success",
              lastReloadAt: reloadAt
            })
          };
        }

        dependencies.logger.error(`${service.name} manual reload failed.`, {
          serviceKey: service.key,
          backend: BACKEND_IDS.CDP,
          errorReason: reloaded.parseResult.errorReason
        });

        return {
          ...reloaded,
          backend: buildFailureDiagnostics({
            service,
            parseResult: reloaded.parseResult,
            extraction: reloaded.extraction,
            projectedFailures,
            sourceState,
            serviceState,
            status: hasKnownUsage(sourceState, serviceState) ? SOURCE_STATUSES.STALE : SOURCE_STATUSES.FAILED,
            freshness: failureFreshness(sourceState, serviceState),
            action: "manual-reload-failed",
            lastReloadAt: reloadAt,
            lastError: reloaded.parseResult.errorReason
          })
        };
      } finally {
        reloadingSources.delete(service.key);
      }
    }

    const first = await performRead(context, { phase: "initial" });

    if (first.parseResult.ok) {
      dependencies.logger.info(`${service.name} CDP read success.`, {
        serviceKey: service.key,
        backend: BACKEND_IDS.CDP,
        phase: "initial",
        parseMethod: first.parseResult.parseMethod,
        parseConfidence: first.parseResult.parseConfidence
      });
      return {
        ...first,
        backend: buildSuccessDiagnostics({
          service,
          parseResult: first.parseResult,
          extraction: first.extraction
        })
      };
    }

    dependencies.logger.warn(`${service.name} CDP read failure.`, {
      serviceKey: service.key,
      backend: BACKEND_IDS.CDP,
      phase: "initial",
      errorReason: first.parseResult.errorReason
    });

    const retry = await performRead(context, { phase: "retry" });

    if (retry.parseResult.ok) {
      dependencies.logger.info(`${service.name} CDP retry success.`, {
        serviceKey: service.key,
        backend: BACKEND_IDS.CDP,
        parseMethod: retry.parseResult.parseMethod,
        parseConfidence: retry.parseResult.parseConfidence
      });
      return {
        ...retry,
        backend: buildSuccessDiagnostics({
          service,
          parseResult: retry.parseResult,
          extraction: retry.extraction,
          action: "retry-success"
        })
      };
    }

    dependencies.logger.warn(`${service.name} CDP retry failure.`, {
      serviceKey: service.key,
      backend: BACKEND_IDS.CDP,
      errorReason: retry.parseResult.errorReason
    });

    const selected = await rediscoverTarget(context);

    if (!selected) {
      return {
        ...retry,
        backend: buildFailureDiagnostics({
          service,
          parseResult: retry.parseResult,
          extraction: retry.extraction,
          projectedFailures,
          sourceState,
          serviceState,
          status: SOURCE_STATUSES.MISSING,
          freshness: failureFreshness(sourceState, serviceState),
          action: "target-rediscovery-failed",
          lastError: retry.parseResult.errorReason || "target_missing"
        })
      };
    }

    const rediscovered = await performRead(context, { phase: "target-rediscovery" });

    if (rediscovered.parseResult.ok) {
      return {
        ...rediscovered,
        backend: buildSuccessDiagnostics({
          service,
          parseResult: rediscovered.parseResult,
          extraction: rediscovered.extraction,
          action: "target-rediscovery-success"
        })
      };
    }

    const reloadDecision = shouldAttemptReload({
      serviceKey: service.key,
      projectedFailures,
      sourceState,
      now,
      policy: dependencies.policy
    });

    if (!reloadDecision.allowed) {
      const action = reloadDecision.cooldownMs > 0
        ? "reload-skipped-cooldown"
        : reloadDecision.reloading
          ? "reload-skipped-in-progress"
          : "reload-threshold-not-met";

      dependencies.logger.warn(`${service.name} reload skipped.`, {
        serviceKey: service.key,
        backend: BACKEND_IDS.CDP,
        action,
        projectedFailures,
        threshold: reloadDecision.threshold,
        cooldownMs: reloadDecision.cooldownMs
      });

      return {
        ...rediscovered,
        backend: buildFailureDiagnostics({
          service,
          parseResult: rediscovered.parseResult,
          extraction: rediscovered.extraction,
          projectedFailures,
          sourceState,
          serviceState,
          status: failureStatus(projectedFailures, sourceState, serviceState),
          freshness: failureFreshness(sourceState, serviceState),
          action,
          lastError: rediscovered.parseResult.errorReason
        })
      };
    }

    const reloadAt = now.toISOString();

    reloadingSources.add(service.key);
    dependencies.logger.warn(`${service.name} reload start.`, {
      serviceKey: service.key,
      backend: BACKEND_IDS.CDP,
      projectedFailures,
      threshold: reloadDecision.threshold
    });

    try {
      const reloaded = await performRead(context, {
        phase: "reload",
        reload: true,
        postReloadWaitMs: dependencies.policy.waitAfterReloadMs[service.key] || 7000
      });

      if (reloaded.parseResult.ok) {
        dependencies.logger.info(`${service.name} reload success.`, {
          serviceKey: service.key,
          backend: BACKEND_IDS.CDP,
          parseMethod: reloaded.parseResult.parseMethod,
          parseConfidence: reloaded.parseResult.parseConfidence
        });
        return {
          ...reloaded,
          backend: buildSuccessDiagnostics({
            service,
            parseResult: reloaded.parseResult,
            extraction: reloaded.extraction,
            action: "reload-success",
            lastReloadAt: reloadAt
          })
        };
      }

      dependencies.logger.error(`${service.name} reload failed.`, {
        serviceKey: service.key,
        backend: BACKEND_IDS.CDP,
        errorReason: reloaded.parseResult.errorReason
      });

      return {
        ...reloaded,
        backend: buildFailureDiagnostics({
          service,
          parseResult: reloaded.parseResult,
          extraction: reloaded.extraction,
          projectedFailures,
          sourceState,
          serviceState,
          status: hasKnownUsage(sourceState, serviceState) ? SOURCE_STATUSES.STALE : SOURCE_STATUSES.FAILED,
          freshness: failureFreshness(sourceState, serviceState),
          action: "reload-failed",
          lastReloadAt: reloadAt,
          lastError: reloaded.parseResult.errorReason
        })
      };
    } finally {
      reloadingSources.delete(service.key);
    }
  }

  return {
    id: BACKEND_IDS.CDP,
    source: service.key,
    supportsManualRefresh: true,
    supportsReload: true,
    supportsReconnect: true,
    readUsage
  };
}

module.exports = {
  DEFAULT_RELOAD_POLICY,
  createCdpBackend,
  cooldownRemainingMs,
  shouldAttemptReload
};
