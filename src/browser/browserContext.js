const path = require("path");
const { chromium } = require("playwright");

const logger = require("../utils/logger");

const BROWSER_PROFILE_PATH = path.resolve("browser-profile");

async function getCdpBrowserContext(config) {
  let browser;

  try {
    browser = await chromium.connectOverCDP(config.chromeCdpUrl, { noDefaults: true });
  } catch (error) {
    const cdpError = new Error("Chrome CDP is not reachable. Start Chrome with --remote-debugging-port=9222.");
    cdpError.cause = error;
    throw cdpError;
  }

  const contexts = browser.contexts();
  let context = contexts[0];
  let createdContext = false;

  if (!context) {
    context = await browser.newContext();
    createdContext = true;
    logger.warn("No existing Chrome CDP context was found. Created a temporary context without the user's logged-in session.");
  }

  return {
    mode: "cdp",
    browser,
    context,
    createdContext,
    cdpUrl: config.chromeCdpUrl
  };
}

async function getPersistentBrowserContext(config) {
  const context = await chromium.launchPersistentContext(BROWSER_PROFILE_PATH, {
    headless: config.headless,
    viewport: { width: 1280, height: 900 }
  });

  return {
    mode: "persistent",
    context,
    browserProfilePath: "browser-profile"
  };
}

async function getBrowserContext(config) {
  if (config.browserConnectionMode === "cdp") {
    return getCdpBrowserContext(config);
  }

  if (config.browserConnectionMode === "persistent") {
    return getPersistentBrowserContext(config);
  }

  throw new Error("BROWSER_CONNECTION_MODE must be either cdp or persistent.");
}

async function closeBrowserResources(resources) {
  if (!resources) {
    return;
  }

  if (resources.mode === "cdp") {
    if (resources.createdContext && resources.context) {
      await resources.context.close().catch(() => {});
    }

    if (resources.browser && typeof resources.browser.disconnect === "function") {
      await resources.browser.disconnect();
    }

    return;
  }

  if (resources.context) {
    await resources.context.close().catch(() => {});
  }
}

module.exports = {
  closeBrowserResources,
  getBrowserContext
};
