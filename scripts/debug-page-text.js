const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const { loadConfig } = require("../src/config");
const logger = require("../src/utils/logger");
const { selectServices } = require("../src/services");
const { extractUsagePage } = require("../src/extractors/usageExtractor");

const BROWSER_PROFILE_PATH = path.resolve("browser-profile");
const LOGS_PATH = path.resolve("logs");

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
    loginState: extraction.loginState,
    error: extraction.error,
    percentTokens: extraction.percentTokens,
    candidateLines: extraction.candidateLines,
    domCandidates: extraction.domCandidates,
    accessibilityCandidates: extraction.accessibilityCandidates,
    parseResult: {
      ok: parseResult.ok,
      shortWindowPercent: parseResult.shortWindowPercent,
      weeklyPercent: parseResult.weeklyPercent,
      parseMethod: parseResult.parseMethod,
      parseConfidence: parseResult.parseConfidence,
      errorReason: parseResult.errorReason
    }
  };

  fs.writeFileSync(textPath, `${extraction.bodyText || ""}\n`, "utf8");
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  return {
    textPath: path.relative(process.cwd(), textPath),
    summaryPath: path.relative(process.cwd(), summaryPath)
  };
}

async function main() {
  const config = loadConfig();
  const services = selectServices(config, process.argv.slice(2));
  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_PATH, {
    headless: config.headless,
    viewport: { width: 1280, height: 900 }
  });

  try {
    for (const service of services) {
      logger.info(`Debug extraction started for ${service.name}.`);
      const extraction = await extractUsagePage(context, service, config);
      const parseResult = service.parser(extraction);
      const artifacts = writeDiagnostics(service, extraction, parseResult);

      logger.info(`Debug extraction completed for ${service.name}.`, {
        ok: parseResult.ok,
        parseMethod: parseResult.parseMethod,
        parseConfidence: parseResult.parseConfidence,
        shortWindowPercentFound: parseResult.shortWindowPercent !== null,
        weeklyPercentFound: parseResult.weeklyPercent !== null,
        errorReason: parseResult.errorReason,
        percentCount: extraction.percentTokens.length,
        candidateLineCount: extraction.candidateLines.length,
        artifacts
      });
    }
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  logger.error(`Debug page text failed: ${error.message}`, error);
  process.exitCode = 1;
});
