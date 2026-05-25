const path = require("path");
const { chromium } = require("playwright");

const { loadConfig } = require("../src/config");
const logger = require("../src/utils/logger");
const { selectServices } = require("../src/services");

const BROWSER_PROFILE_PATH = path.resolve("browser-profile");

async function main() {
  const config = loadConfig();
  const requestedKeys = process.argv.slice(2).map((key) => key.toLowerCase());
  const services = selectServices(config, requestedKeys);

  logger.info("Opening persistent Playwright profile for manual login.", {
    services: services.map((service) => service.key),
    browserProfilePath: "browser-profile"
  });

  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_PATH, {
    headless: false,
    viewport: { width: 1280, height: 900 }
  });

  for (const service of services) {
    const page = await context.newPage();
    await page.goto(service.usageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    }).catch((error) => {
      logger.warn(`${service.name} login page navigation failed. You can still use the opened browser manually.`, {
        reason: error.name === "TimeoutError" ? "navigation timeout" : "navigation failure",
        message: error.message
      });
    });
  }

  logger.info("Log in to the opened Codex/Claude pages manually.");
  logger.info("Keep this browser profile for later monitor runs. Close the browser or press Ctrl+C when login is done.");

  await new Promise((resolve) => {
    context.on("close", resolve);
    process.on("SIGINT", async () => {
      await context.close().catch(() => {});
      resolve();
    });
    process.on("SIGTERM", async () => {
      await context.close().catch(() => {});
      resolve();
    });
  });
}

main().catch((error) => {
  logger.error(`Login setup failed: ${error.message}`, error);
  process.exitCode = 1;
});
