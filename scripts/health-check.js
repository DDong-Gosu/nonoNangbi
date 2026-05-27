const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { loadConfig } = require("../src/config");
const { getGitOutputStatus } = require("../src/output/gitOutputStatus");

const LABEL = "com.donghoon.mongi-usage-coach";
const LOG_SIZE_WARNING_BYTES = 5 * 1024 * 1024;
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");
const PLIST_PATH = path.join(process.env.HOME || "", "Library/LaunchAgents", `${LABEL}.plist`);
const OUT_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-out.log");
const ERROR_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-error.log");

function exists(filePath) {
  return fs.existsSync(filePath);
}

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "unknown" : String(value);
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

function readTail(filePath, maxBytes = 256 * 1024) {
  try {
    const stat = fs.statSync(filePath);
    const length = Math.min(stat.size, maxBytes);
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, stat.size - length);
    fs.closeSync(fd);
    return buffer.toString("utf8");
  } catch {
    return "";
  }
}

function parseJsonSuffix(line) {
  const jsonStart = line.indexOf("{");

  if (jsonStart === -1) {
    return null;
  }

  try {
    return JSON.parse(line.slice(jsonStart));
  } catch {
    return null;
  }
}

function findLastMatch(lines, pattern) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = lines[index].match(pattern);

    if (match) {
      return match;
    }
  }

  return null;
}

function launchdLoaded() {
  try {
    execFileSync("launchctl", ["list", LABEL], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function cdpReachable(cdpUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const versionUrl = `${cdpUrl.replace(/\/$/, "")}/json/version`;

  try {
    const response = await fetch(versionUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function quietHoursActive(quietHours, now = new Date()) {
  if (!quietHours || !quietHours.enabled) {
    return false;
  }

  const hour = now.getHours();
  const start = quietHours.startHour;
  const end = quietHours.endHour;

  if (start === end) {
    return true;
  }

  if (start < end) {
    return hour >= start && hour < end;
  }

  return hour >= start || hour < end;
}

function readState(stateFilePath) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, stateFilePath), "utf8"));
  } catch {
    return null;
  }
}

function summarizeRecentLogs() {
  const lines = readTail(OUT_LOG_PATH).split(/\r?\n/).filter(Boolean);
  const started = findLastMatch(lines, /^\[(.+)] Mongi monitor wrapper started\./);
  const finished = findLastMatch(lines, /^\[(.+)] Mongi monitor wrapper finished with exit code (\d+)\./);
  const monitorCompletedLine = [...lines].reverse().find((line) => line.includes("Monitor run completed."));
  const monitorCompleted = monitorCompletedLine ? parseJsonSuffix(monitorCompletedLine) : null;

  return {
    lastWrapperStartedAt: started ? started[1] : null,
    lastWrapperFinishedAt: finished ? finished[1] : null,
    lastExitCode: finished ? finished[2] : null,
    notificationsSent: monitorCompleted ? monitorCompleted.notificationsSent : null,
    services: monitorCompleted && Array.isArray(monitorCompleted.services) ? monitorCompleted.services : []
  };
}

function printService(name, service) {
  if (!service) {
    console.log(`- ${name}: missing`);
    console.log("  Next: Run npm run monitor");
    return;
  }

  console.log(`- ${name}: short remaining ${formatValue(service.remainingShortWindowPercent)}, weekly remaining ${formatValue(service.remainingWeeklyPercent)}, short used ${formatValue(service.usedShortWindowPercent)}, weekly used ${formatValue(service.usedWeeklyPercent)}, failures ${Number(service.consecutiveParseFailures || 0)}, checked ${formatValue(service.lastCheckedAt)}`);

  if (Number(service.consecutiveParseFailures || 0) > 0) {
    if (service.lastParseFailureReason === "usage_page_not_open") {
      console.log("  Next: Open Mongi Start.app, double-click Mongi Start.command, or run npm run start:chrome. Then confirm the usage page is visible.");
    } else {
      console.log(`  Next: Check login/Turnstile, then run npm run debug:page-text -- ${name.toLowerCase()}`);
    }
  }
}

function serviceHasMissingUsagePage(serviceKey, state, recentLogs) {
  const serviceState = state && state.services && state.services[serviceKey];

  if (serviceState && serviceState.lastParseFailureReason === "usage_page_not_open") {
    return true;
  }

  return recentLogs.services.some((service) => service.serviceKey === serviceKey && service.errorReason === "usage_page_not_open");
}

async function main() {
  const config = loadConfig();
  const statePath = path.resolve(PROJECT_ROOT, config.stateFilePath);
  const stateExists = exists(statePath);
  const state = stateExists ? readState(config.stateFilePath) : null;
  const cdpOk = await cdpReachable(config.chromeCdpUrl);
  const loaded = launchdLoaded();
  const recentLogs = summarizeRecentLogs();
  const quietActive = quietHoursActive(config.quietHours);
  const output = getGitOutputStatus({
    cwd: PROJECT_ROOT,
    now: new Date(),
    quietHoursActive: quietActive
  });
  const outLogSize = fileSize(OUT_LOG_PATH);
  const errorLogSize = fileSize(ERROR_LOG_PATH);
  const warnings = [];
  const nextActions = [];

  if (!exists(ENV_PATH)) {
    nextActions.push("Create .env from .env.example");
  }

  if (!config.discordWebhookUrl) {
    nextActions.push("Set DISCORD_WEBHOOK_URL in .env if Discord notifications are needed");
  }

  if (!cdpOk && config.browserConnectionMode === "cdp") {
    nextActions.push("Open Mongi Start.app, double-click Mongi Start.command, or run npm run start:chrome");
  }

  if (!exists(PLIST_PATH) || !loaded) {
    nextActions.push("Run npm run launchd:install");
  }

  if (!stateExists) {
    nextActions.push("Run npm run monitor to create state");
  }

  const missingUsagePages = [
    serviceHasMissingUsagePage("codex", state, recentLogs) ? "Codex" : null,
    serviceHasMissingUsagePage("claude", state, recentLogs) ? "Claude" : null
  ].filter(Boolean);

  if (missingUsagePages.length > 0) {
    nextActions.push(`Confirm ${missingUsagePages.join("/")} usage pages are open in the CDP Chrome profile`);
  }

  if (quietActive) {
    nextActions.push("Discord event notifications may be suppressed during quiet hours");
  }

  for (const [label, size] of [["launchd stdout", outLogSize], ["launchd stderr", errorLogSize]]) {
    if (size !== null && size > LOG_SIZE_WARNING_BYTES) {
      warnings.push(`${label} log is getting large. Consider truncating manually after reviewing.`);
    }
  }

  console.log("Mongi Health Check");
  console.log("");
  console.log("Config:");
  console.log(`- .env: ${exists(ENV_PATH) ? "found" : "missing"}`);
  console.log(`- Discord webhook: ${config.discordWebhookUrl ? "configured" : "missing"}`);
  console.log(`- Browser mode: ${config.browserConnectionMode}`);
  console.log(`- CDP URL: ${config.chromeCdpUrl}`);
  console.log(`- CDP reachable: ${cdpOk ? "yes" : "no"}`);
  console.log("");
  console.log("Launchd:");
  console.log(`- plist: ${exists(PLIST_PATH) ? "installed" : "missing"}`);
  console.log(`- loaded: ${loaded ? "yes" : "no"}`);
  console.log(`- stdout log: ${exists(OUT_LOG_PATH) ? "found" : "missing"}`);
  console.log(`- stderr log: ${exists(ERROR_LOG_PATH) ? "found" : "missing"}`);
  console.log(`- last wrapper started: ${formatValue(recentLogs.lastWrapperStartedAt)}`);
  console.log(`- last wrapper finished: ${formatValue(recentLogs.lastWrapperFinishedAt)}`);
  console.log(`- last exit code: ${formatValue(recentLogs.lastExitCode)}`);
  console.log("");
  console.log("Usage:");
  console.log(`- state: ${stateExists ? "found" : "missing"}`);
  printService("Codex", state && state.services && state.services.codex);
  printService("Claude", state && state.services && state.services.claude);
  console.log("");
  console.log("Notifications:");
  console.log(`- quiet hours active: ${quietActive ? "yes" : "no"}`);
  console.log(`- quiet hours window: ${config.quietHours.enabled ? `${config.quietHours.startHour}:00-${config.quietHours.endHour}:00` : "disabled"}`);
  console.log(`- recent launchd notifications sent: ${formatValue(recentLogs.notificationsSent)}`);
  console.log("");
  console.log("Output:");
  console.log(`- status: ${output.outputStatus}`);
  console.log(`- reason: ${output.reason}`);
  console.log(`- git repository: ${output.repository.available ? "yes" : "no"}`);
  console.log(`- branch: ${formatValue(output.repository.branch)}`);
  console.log(`- upstream: ${formatValue(output.repository.upstream)}`);
  console.log(`- local changes: ${output.hasLocalChanges ? "yes" : "no"}`);
  console.log(`- unpushed commits: ${output.hasUnpushedCommits ? "yes" : "no"}`);
  console.log(`- shipped today: ${output.hasShippedToday ? "yes" : "no"}`);
  console.log(`- quiet hours modifier: ${output.quietHoursActive ? "yes" : "no"}`);

  if (warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (nextActions.length > 0) {
    console.log("");
    console.log("Next actions:");
    for (const action of nextActions) {
      console.log(`- ${action}`);
    }
  }
}

main().catch((error) => {
  console.error(`Health check failed: ${error.message}`);
  process.exit(1);
});
