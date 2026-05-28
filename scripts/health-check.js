const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { loadConfig } = require("../src/config");
const { getGitOutputStatus } = require("../src/output/gitOutputStatus");
const { healthLogPath, ensureRuntimeDirs } = require("../src/runtime/paths");
const { DEFAULT_RELOAD_POLICY, cooldownRemainingMs } = require("../src/backends/cdpBackend");

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

async function cdpTargetList(cdpUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const listUrl = `${cdpUrl.replace(/\/$/, "")}/json/list`;

  try {
    const response = await fetch(listUrl, { signal: controller.signal });

    if (!response.ok) {
      return null;
    }

    const list = await response.json();
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function targetMatches(serviceKey, target) {
  const rawUrl = target && target.url ? String(target.url) : "";

  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const location = `${url.pathname}${url.search}${url.hash}`.toLowerCase();

    if (serviceKey === "codex") {
      return host.includes("chatgpt.com") && (
        location.includes("analytics") ||
        location.includes("usage") ||
        (location.includes("codex") && location.includes("settings"))
      );
    }

    if (serviceKey === "claude") {
      return host.includes("claude.ai") && location.includes("settings") && location.includes("usage");
    }
  } catch {
    return false;
  }

  return false;
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
    return JSON.parse(fs.readFileSync(stateFilePath, "utf8"));
  } catch {
    return null;
  }
}

function writeHealthLog(line) {
  try {
    ensureRuntimeDirs();
    fs.appendFileSync(healthLogPath, `[${new Date().toISOString()}] ${line}\n`);
  } catch (error) {
    process.stderr.write(`[health] failed to write health log: ${error.message}\n`);
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

function printService(name, service, source) {
  if (!service) {
    console.log(`- ${name}: missing`);
    console.log("  Next: Run npm run monitor");
    return;
  }

  const successAt = service.lastSuccessfulCheckedAt || (Number(service.consecutiveParseFailures || 0) > 0 ? null : service.lastCheckedAt);
  const attemptedAt = service.lastAttemptedAt || service.lastCheckedAt;
  const sourceFailures = Number(source && source.consecutiveFailures || service.consecutiveParseFailures || 0);
  const reloadCooldown = source ? cooldownRemainingMs(source, new Date(), DEFAULT_RELOAD_POLICY) : null;

  console.log(`- ${name}: backend ${formatValue(source && source.backend || "cdp")}, status ${formatValue(source && source.status)}, freshness ${formatValue(source && source.freshness)}, short remaining ${formatValue(service.remainingShortWindowPercent)}, weekly remaining ${formatValue(service.remainingWeeklyPercent)}, failures ${sourceFailures}, checked ${formatValue(source && source.lastFreshReadAt || successAt)}, attempted ${formatValue(source && source.lastAttemptAt || attemptedAt)}`);
  console.log(`  Recovery: last action ${formatValue(source && source.lastRecoveryAction)}, last reload ${formatValue(source && source.lastReloadAt)}, reload cooldown ${reloadCooldown === null ? "unknown" : `${reloadCooldown}ms`}`);
  console.log(`  Freshness: reason ${formatValue(source && source.freshnessDecisionReason)}, exact URL ${formatValue(source && source.exactConfiguredUrlMatch)}, guard ${formatValue(source && source.sourceUrlGuardPassed)}, labels ${formatValue(source && source.expectedUsageLabelsPresent)}, read after reload ${formatValue(source && source.readAfterReload)}, source reloaded ${formatValue(source && source.sourceReloadedAt)}, parse failed ${formatValue(source && source.lastParseFailedAt || service.lastParseFailedAt || service.lastParseFailureAt)}, candidates ${formatValue(source && source.candidateCount)}`);

  if (source && source.target) {
    console.log(`  Target: found / ${formatValue(source.target.title)} / ${formatValue(source.target.url)} / exact ${formatValue(source.target.exactConfiguredUrlMatch)} / guard ${formatValue(source.target.sourceUrlGuardPassed)}`);
  } else if (service.source && service.source.selectedTab) {
    console.log(`  Target: found / ${formatValue(service.source.selectedTab.title)} / ${formatValue(service.source.selectedTab.url)}`);
  } else {
    console.log("  Target: unknown");
  }

  if (sourceFailures > 0) {
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
  const statePath = config.stateFilePath;
  const stateExists = exists(statePath);
  const state = stateExists ? readState(statePath) : null;
  const cdpOk = await cdpReachable(config.chromeCdpUrl);
  const targets = cdpOk ? await cdpTargetList(config.chromeCdpUrl) : null;
  const codexTargetFound = Array.isArray(targets) && targets.some((target) => targetMatches("codex", target));
  const claudeTargetFound = Array.isArray(targets) && targets.some((target) => targetMatches("claude", target));
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
  console.log(`- CDP target list: ${Array.isArray(targets) ? "reachable" : "unreachable"}`);
  console.log(`- Codex target found: ${codexTargetFound ? "yes" : "no"}`);
  console.log(`- Claude target found: ${claudeTargetFound ? "yes" : "no"}`);
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
  console.log(`- state path: ${statePath}`);
  console.log(`- state: ${stateExists ? "found" : "missing"}`);
  printService("Codex", state && state.services && state.services.codex, state && state.sources && state.sources.codex);
  printService("Claude", state && state.services && state.services.claude, state && state.sources && state.sources.claude);
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

  writeHealthLog(
    `state=${stateExists ? "found" : "missing"} cdp=${cdpOk ? "yes" : "no"} codexTarget=${codexTargetFound ? "yes" : "no"} claudeTarget=${claudeTargetFound ? "yes" : "no"} output=${output.outputStatus} nextActions=${nextActions.length}`
  );
}

main().catch((error) => {
  console.error(`Health check failed: ${error.message}`);
  process.exit(1);
});
