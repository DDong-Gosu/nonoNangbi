const logger = require("../utils/logger");
const { extractUsagePage, listUsagePageCandidates, selectUsagePageCandidate, configuredUsageUrlMatches, serviceUsagePageMatches } = require("../extractors/usageExtractor");
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
    matchType: selectedTab.matchType || null,
    exactConfiguredUrlMatch: Boolean(selectedTab.exactConfiguredUrlMatch),
    sourceUrlGuardPassed: Boolean(selectedTab.sourceUrlGuardPassed)
  };
}

function sourceMetadataFromExtraction(service, extraction) {
  const source = extraction && extraction.source;
  const selectedTab = source && source.selectedTab;
  const selectedUrl = selectedTab && selectedTab.url ? selectedTab.url : extraction && extraction.finalUrl;
  const exactConfiguredUrlMatch = configuredUsageUrlMatches(selectedUrl, service.usageUrl);
  const sourceUrlGuardPassed = serviceUsagePageMatches(service, selectedUrl);

  return {
    candidateCount: source && Number.isFinite(Number(source.candidateCount)) ? Number(source.candidateCount) : 0,
    tabCount: source && Number.isFinite(Number(source.tabCount)) ? Number(source.tabCount) : 0,
    selectedTargetUrl: selectedUrl || "",
    selectedTargetTitle: selectedTab && selectedTab.title ? selectedTab.title : "",
    exactConfiguredUrlMatch,
    sourceUrlGuardPassed,
    readAfterReload: source && source.reloadedExistingPage !== undefined ? Boolean(source.reloadedExistingPage) : null,
    sourceReloadedAt: source && source.reloadedExistingPage ? extraction.extractedAt : null,
    expectedUsageLabelsPresent: extraction && extraction.expectedUsageLabelsPresent !== undefined ? Boolean(extraction.expectedUsageLabelsPresent) : null
  };
}

function isPercentValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100;
}

function validateFreshRead({ service, extraction, parseResult, reloadRequired = false }) {
  const source = extraction && extraction.source;
  const selectedTab = source && source.selectedTab;
  const metadata = sourceMetadataFromExtraction(service, extraction);

  if (!selectedTab) {
    return { ok: false, reason: "freshness_rejected_target_missing", metadata };
  }

  if (!metadata.sourceUrlGuardPassed) {
    return { ok: false, reason: "freshness_rejected_source_url_guard_failed", metadata };
  }

  if (!metadata.exactConfiguredUrlMatch && selectedTab.matchType !== "provider_url_pattern") {
    return { ok: false, reason: "freshness_rejected_no_source_match_evidence", metadata };
  }

  if (extraction && extraction.error) {
    return { ok: false, reason: extraction.error.reason || "freshness_rejected_extraction_failed", metadata };
  }

  if (metadata.expectedUsageLabelsPresent === false) {
    return { ok: false, reason: "freshness_rejected_expected_usage_labels_missing", metadata };
  }

  if (!parseResult || parseResult.ok !== true) {
    return { ok: false, reason: parseResult && parseResult.errorReason || "freshness_rejected_parser_invalid", metadata };
  }

  if (!isPercentValue(parseResult.remainingShortWindowPercent) || !isPercentValue(parseResult.remainingWeeklyPercent)) {
    return { ok: false, reason: "freshness_rejected_normalization_invalid", metadata };
  }

  if (reloadRequired && metadata.readAfterReload === false) {
    return { ok: false, reason: "freshness_rejected_reload_read_missing", metadata };
  }

  return {
    ok: true,
    reason: metadata.exactConfiguredUrlMatch ? "fresh_verified_exact_url_reload_read" : "fresh_verified_provider_url_guard_reload_read",
    metadata
  };
}

function guardedFailureParseResult(parseResult, validation) {
  return {
    ...parseResult,
    ok: false,
    errorReason: validation.reason,
    freshnessDecisionReason: validation.reason
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
  const sourceMetadata = sourceMetadataFromExtraction(service, extraction);
  return createBackendDiagnostics({
    backend: BACKEND_IDS.CDP,
    status: status || failureStatus(projectedFailures, sourceState, serviceState),
    freshness: freshness || failureFreshness(sourceState, serviceState),
    lastRecoveryAction: action || null,
    lastReloadAt: lastReloadAt || null,
    lastError: lastError || parseResult.errorReason || (extraction && extraction.error && extraction.error.reason) || "read_failed",
    target: sourceTargetFromExtraction(extraction),
    projectedFailures,
    source: service.key,
    freshnessDecisionReason: parseResult.freshnessDecisionReason || parseResult.errorReason || (extraction && extraction.error && extraction.error.reason) || "read_failed",
    ...sourceMetadata
  });
}

function buildSuccessDiagnostics({ service, parseResult, extraction, action, lastReloadAt, validation }) {
  const sourceMetadata = validation && validation.metadata ? validation.metadata : sourceMetadataFromExtraction(service, extraction);
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
    parseConfidence: parseResult.parseConfidence,
    freshnessDecisionReason: validation && validation.reason ? validation.reason : "fresh_verified",
    ...sourceMetadata
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

  function finalizeRead(read, { action = null, lastReloadAt = null, reloadRequired = false, projectedFailures = 1, sourceState = null, serviceState = null } = {}) {
    const validation = validateFreshRead({
      service,
      extraction: read.extraction,
      parseResult: read.parseResult,
      reloadRequired
    });

    if (validation.ok) {
      return {
        ...read,
        backend: buildSuccessDiagnostics({
          service,
          parseResult: read.parseResult,
          extraction: read.extraction,
          action,
          lastReloadAt,
          validation
        })
      };
    }

    const guardedParseResult = guardedFailureParseResult(read.parseResult, validation);

    return {
      ...read,
      parseResult: guardedParseResult,
      backend: buildFailureDiagnostics({
        service,
        parseResult: guardedParseResult,
        extraction: read.extraction,
        projectedFailures,
        sourceState,
        serviceState,
        status: failureStatus(projectedFailures, sourceState, serviceState),
        freshness: failureFreshness(sourceState, serviceState),
        action: action ? `${action}-freshness-rejected` : "freshness-rejected",
        lastReloadAt,
        lastError: validation.reason
      })
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

        const finalized = finalizeRead(reloaded, {
          action: "manual-reload-success",
          lastReloadAt: reloadAt,
          reloadRequired: true,
          projectedFailures,
          sourceState,
          serviceState
        });

        if (finalized.parseResult.ok) {
          dependencies.logger.info(`${service.name} manual reload success.`, {
            serviceKey: service.key,
            backend: BACKEND_IDS.CDP,
            parseMethod: finalized.parseResult.parseMethod,
            parseConfidence: finalized.parseResult.parseConfidence,
            freshnessDecisionReason: finalized.backend.freshnessDecisionReason
          });
          return finalized;
        }

        dependencies.logger.error(`${service.name} manual reload failed.`, {
          serviceKey: service.key,
          backend: BACKEND_IDS.CDP,
          errorReason: finalized.parseResult.errorReason
        });

        return {
          ...finalized,
          backend: buildFailureDiagnostics({
            service,
            parseResult: finalized.parseResult,
            extraction: finalized.extraction,
            projectedFailures,
            sourceState,
            serviceState,
            status: hasKnownUsage(sourceState, serviceState) ? SOURCE_STATUSES.STALE : SOURCE_STATUSES.FAILED,
            freshness: failureFreshness(sourceState, serviceState),
            action: "manual-reload-failed",
            lastReloadAt: reloadAt,
            lastError: finalized.parseResult.errorReason
          })
        };
      } finally {
        reloadingSources.delete(service.key);
      }
    }

    const first = await performRead(context, { phase: "initial" });

    const finalizedFirst = first.parseResult.ok ? finalizeRead(first, {
      projectedFailures,
      sourceState,
      serviceState
    }) : first;

    if (finalizedFirst.parseResult.ok) {
      dependencies.logger.info(`${service.name} CDP read success.`, {
        serviceKey: service.key,
        backend: BACKEND_IDS.CDP,
        phase: "initial",
        parseMethod: finalizedFirst.parseResult.parseMethod,
        parseConfidence: finalizedFirst.parseResult.parseConfidence,
        freshnessDecisionReason: finalizedFirst.backend.freshnessDecisionReason
      });
      return finalizedFirst;
    }

    dependencies.logger.warn(`${service.name} CDP read failure.`, {
      serviceKey: service.key,
      backend: BACKEND_IDS.CDP,
      phase: "initial",
      errorReason: finalizedFirst.parseResult.errorReason
    });

    const retry = await performRead(context, { phase: "retry" });

    const finalizedRetry = retry.parseResult.ok ? finalizeRead(retry, {
      action: "retry-success",
      projectedFailures,
      sourceState,
      serviceState
    }) : retry;

    if (finalizedRetry.parseResult.ok) {
      dependencies.logger.info(`${service.name} CDP retry success.`, {
        serviceKey: service.key,
        backend: BACKEND_IDS.CDP,
        parseMethod: finalizedRetry.parseResult.parseMethod,
        parseConfidence: finalizedRetry.parseResult.parseConfidence,
        freshnessDecisionReason: finalizedRetry.backend.freshnessDecisionReason
      });
      return finalizedRetry;
    }

    dependencies.logger.warn(`${service.name} CDP retry failure.`, {
      serviceKey: service.key,
      backend: BACKEND_IDS.CDP,
      errorReason: finalizedRetry.parseResult.errorReason
    });

    const selected = await rediscoverTarget(context);

    if (!selected) {
      return {
        ...retry,
        backend: buildFailureDiagnostics({
          service,
          parseResult: finalizedRetry.parseResult,
          extraction: finalizedRetry.extraction,
          projectedFailures,
          sourceState,
          serviceState,
          status: SOURCE_STATUSES.MISSING,
          freshness: failureFreshness(sourceState, serviceState),
          action: "target-rediscovery-failed",
          lastError: finalizedRetry.parseResult.errorReason || "target_missing"
        })
      };
    }

    const rediscovered = await performRead(context, { phase: "target-rediscovery" });

    const finalizedRediscovered = rediscovered.parseResult.ok ? finalizeRead(rediscovered, {
      action: "target-rediscovery-success",
      projectedFailures,
      sourceState,
      serviceState
    }) : rediscovered;

    if (finalizedRediscovered.parseResult.ok) {
      return finalizedRediscovered;
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
        ...finalizedRediscovered,
        backend: buildFailureDiagnostics({
          service,
          parseResult: finalizedRediscovered.parseResult,
          extraction: finalizedRediscovered.extraction,
          projectedFailures,
          sourceState,
          serviceState,
          status: failureStatus(projectedFailures, sourceState, serviceState),
          freshness: failureFreshness(sourceState, serviceState),
          action,
          lastError: finalizedRediscovered.parseResult.errorReason
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

      const finalizedReload = reloaded.parseResult.ok ? finalizeRead(reloaded, {
        action: "reload-success",
        lastReloadAt: reloadAt,
        reloadRequired: true,
        projectedFailures,
        sourceState,
        serviceState
      }) : reloaded;

      if (finalizedReload.parseResult.ok) {
        dependencies.logger.info(`${service.name} reload success.`, {
          serviceKey: service.key,
          backend: BACKEND_IDS.CDP,
          parseMethod: finalizedReload.parseResult.parseMethod,
          parseConfidence: finalizedReload.parseResult.parseConfidence,
          freshnessDecisionReason: finalizedReload.backend.freshnessDecisionReason
        });
        return finalizedReload;
      }

      dependencies.logger.error(`${service.name} reload failed.`, {
        serviceKey: service.key,
        backend: BACKEND_IDS.CDP,
        errorReason: finalizedReload.parseResult.errorReason
      });

      return {
        ...finalizedReload,
        backend: buildFailureDiagnostics({
          service,
          parseResult: finalizedReload.parseResult,
          extraction: finalizedReload.extraction,
          projectedFailures,
          sourceState,
          serviceState,
          status: hasKnownUsage(sourceState, serviceState) ? SOURCE_STATUSES.STALE : SOURCE_STATUSES.FAILED,
          freshness: failureFreshness(sourceState, serviceState),
          action: "reload-failed",
          lastReloadAt: reloadAt,
          lastError: finalizedReload.parseResult.errorReason
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
