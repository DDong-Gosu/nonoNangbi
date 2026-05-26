const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const DEFAULT_PORT = "9222";
const port = process.env.CHROME_CDP_PORT || DEFAULT_PORT;
const cdpUrl = process.env.CHROME_CDP_URL || `http://127.0.0.1:${port}`;
const versionUrl = `${cdpUrl.replace(/\/$/, "")}/json/version`;

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  try {
    const version = await fetchJson(versionUrl);
    const browser = typeof version.Browser === "string" ? version.Browser : "unknown";
    const webSocketAvailable = typeof version.webSocketDebuggerUrl === "string" && version.webSocketDebuggerUrl.length > 0;

    console.log("CDP Chrome is reachable.");
    console.log(`CDP URL: ${cdpUrl}`);
    console.log(`Browser: ${browser}`);
    console.log(`WebSocket debugger URL: ${webSocketAvailable ? "available" : "not reported"}`);
  } catch (error) {
    console.error("CDP Chrome is not reachable.");
    console.error(`Checked: ${versionUrl}`);
    console.error("Start it with: npm run start:chrome");
    console.error(`Reason: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
