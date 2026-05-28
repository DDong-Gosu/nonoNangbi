const fs = require("fs");
const path = require("path");

const { loadConfig } = require("../src/config");
const logger = require("../src/utils/logger");
const { selectServices } = require("../src/services");
const { extractUsagePage } = require("../src/extractors/usageExtractor");
const { closeBrowserResources, getBrowserContext } = require("../src/browser/browserContext");
const { logsDir } = require("../src/runtime/paths");

const LOGS_PATH = logsDir;

function percentSnippets(lines) {
  return (lines || [])
    .filter((line) => /%/.test(line))
    .map((line) => {
      const match = String(line).match(/(?:100|[1-9]?\d)(?:\.\d+)?\s*%/);
      const index = match ? match.index : 0;
      const start = Math.max(0, index - 90);
      const end = Math.min(String(line).length, index + 90);
      return String(line).slice(start, end).replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .slice(0, 20);
}

function writeDiagnostics(service, extraction, parseResult) {
  fs.mkdirSync(LOGS_PATH, { recursive: true });

  const textPath = path.join(LOGS_PATH, `debug-${service.key}-text.txt`);
  const summaryPath = path.join(LOGS_PATH, `debug-${service.key}-summary.json`);
  const summary = {
    serviceKey: extraction.serviceKey,
    serviceName: extraction.serviceName,
    url: extraction.url,
    finalUrl: extraction.finalUrl,
    extractedAt: extraction.extractedAt,
    navigationStatus: extraction.navigationStatus,
    source: extraction.source || null,
    loginState: extraction.loginState,
    turnstileState: extraction.turnstileState,
    error: extraction.error,
    percentTokens: extraction.percentTokens,
    candidateLineCount: (extraction.candidateLines || []).length,
    domCandidateCount: (extraction.domCandidates || []).length,
    accessibilityCandidateCount: (extraction.accessibilityCandidates || []).length,
    percentSnippets: percentSnippets(extraction.candidateLines),
    parseResult: {
      ok: parseResult.ok,
      shortWindowPercent: parseResult.shortWindowPercent,
      weeklyPercent: parseResult.weeklyPercent,
      rawShortWindowPercent: parseResult.rawShortWindowPercent,
      rawWeeklyPercent: parseResult.rawWeeklyPercent,
      rawShortWindowMeaning: parseResult.rawShortWindowMeaning,
      rawWeeklyPercentMeaning: parseResult.rawWeeklyPercentMeaning,
      remainingShortWindowPercent: parseResult.remainingShortWindowPercent,
      remainingWeeklyPercent: parseResult.remainingWeeklyPercent,
      usedShortWindowPercent: parseResult.usedShortWindowPercent,
      usedWeeklyPercent: parseResult.usedWeeklyPercent,
      shortWindowLabel: parseResult.shortWindowLabel,
      weeklyWindowLabel: parseResult.weeklyWindowLabel,
      parseMethod: parseResult.parseMethod,
      parseConfidence: parseResult.parseConfidence,
      parsedAt: parseResult.parsedAt,
      selectedCandidates: parseResult.selectedCandidates,
      errorReason: parseResult.errorReason
    }
  };

  fs.writeFileSync(textPath, `${summary.percentSnippets.join("\n")}\n`, "utf8");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  return {
    textPath,
    summaryPath
  };
}

async function main() {
  const config = loadConfig();
  const services = selectServices(config, process.argv.slice(2));
  const browserResources = await getBrowserContext(config);
  const context = browserResources.context;

  logger.info("Browser context ready for debug extraction.", {
    mode: browserResources.mode,
    cdpUrl: browserResources.mode === "cdp" ? browserResources.cdpUrl : undefined
  });

  try {
    for (const service of services) {
      logger.info(`Debug extraction started for ${service.name}.`);
      const extraction = await extractUsagePage(context, service, {
        reuseExistingPages: true,
        openMissingPages: true,
        allowFocusSteal: false
      });
      const parseResult = service.parser(extraction);
      const artifacts = writeDiagnostics(service, extraction, parseResult);

      if (parseResult.errorReason === "turnstile_verification_required") {
        logger.warn(`${service.name} requires Turnstile verification. Open normal Chrome through CDP, pass verification manually, then rerun debug.`);
      }

      logger.info(`Debug extraction completed for ${service.name}.`, {
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
        source: extraction.source,
        selectedCandidates: parseResult.selectedCandidates,
        percentCount: extraction.percentTokens.length,
        candidateLineCount: extraction.candidateLines.length,
        artifacts
      });
    }
  } finally {
    await closeBrowserResources(browserResources);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Debug page text failed: ${error.message}`, error);
    process.exit(1);
  });
