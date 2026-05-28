const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { loadConfig } = require("../src/config");
const { getGitOutputStatus } = require("../src/output/gitOutputStatus");
const { loadPolicy, summarizePolicy } = require("../src/policy/policyStore");
const { DEFAULT_RELOAD_POLICY, cooldownRemainingMs } = require("../src/backends/cdpBackend");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const LABEL = "com.donghoon.mongi-usage-coach";
const ENV_PATH = path.join(PROJECT_ROOT, ".env");
const PLIST_PATH = path.join(process.env.HOME || "", "Library/LaunchAgents", `${LABEL}.plist`);
const OUT_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-out.log");
const ERROR_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-error.log");
const DISPATCHABLE_EVENT_TYPES = new Set([
  "recovered_short",
  "recovered_weekly",
  "session_stopped",
  "weekly_idle",
  "parse_failure_digest",
  "cdp_unreachable_digest"
]);

// How far back to look for "current" monitor health
const RECENT_WINDOW_MINUTES = 30;
// Failures older than this are treated as history, not current status
const STALE_WINDOW_MINUTES = 60;

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readTail(filePath, maxBytes = 2 * 1024 * 1024) {
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

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseWrapperTimestamp(value) {
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);

  if (!match) {
    return null;
  }

  return new Date(`${match[1]}T${match[2]}${match[3]}:${match[4]}`);
}

function parseLineTimestamp(line) {
  const wrapperMatch = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4})]/);

  if (wrapperMatch) {
    return parseWrapperTimestamp(wrapperMatch[1]);
  }

  const isoMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T[^\]]+)]/);

  if (isoMatch) {
    const parsed = new Date(isoMatch[1]);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function isToday(line, todayKey) {
  const timestamp = parseLineTimestamp(line);
  return timestamp ? localDateKey(timestamp) === todayKey : false;
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

function increment(counts, key, amount = 1) {
  counts[key] = (counts[key] || 0) + amount;
}

function latestMatch(lines, pattern) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = lines[index].match(pattern);

    if (match) {
      return match;
    }
  }

  return null;
}

function latestCompletedSummary(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].includes("Monitor run completed.")) {
      return parseJsonSuffix(lines[index]);
    }
  }

  return null;
}

function summarizeMonitor(outLines, todayKey) {
  const starts = [];
  const finishes = [];

  for (const line of outLines) {
    const startMatch = line.match(/^\[(.+)] Mongi monitor wrapper started\./);
    const finishMatch = line.match(/^\[(.+)] Mongi monitor wrapper finished with exit code (\d+)\./);

    if (startMatch) {
      const timestamp = parseWrapperTimestamp(startMatch[1]);

      if (timestamp && localDateKey(timestamp) === todayKey) {
        starts.push({ timestamp });
      }
    }

    if (finishMatch) {
      const timestamp = parseWrapperTimestamp(finishMatch[1]);

      if (timestamp && localDateKey(timestamp) === todayKey) {
        finishes.push({
          timestamp,
          exitCode: Number(finishMatch[2])
        });
      }
    }
  }

  const latestFinish = finishes[finishes.length - 1] || null;
  const latestStart = starts[starts.length - 1] || null;

  return {
    runs: starts.length,
    successful: finishes.filter((finish) => finish.exitCode === 0).length,
    failed: finishes.filter((finish) => finish.exitCode !== 0).length,
    latestRun: latestFinish ? latestFinish.timestamp.toISOString() : latestStart && latestStart.timestamp.toISOString(),
    latestExitCode: latestFinish ? latestFinish.exitCode : null
  };
}

// Count wrapper finish lines only within the recent time window.
function summarizeRecentRuns(outLines, windowMinutes) {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
  const finishes = [];

  for (const line of outLines) {
    const match = line.match(/^\[(.+)] Mongi monitor wrapper finished with exit code (\d+)\./);

    if (!match) {
      continue;
    }

    const timestamp = parseWrapperTimestamp(match[1]);

    if (timestamp && timestamp >= cutoff) {
      finishes.push({ timestamp, exitCode: Number(match[2]) });
    }
  }

  return {
    runs: finishes.length,
    failed: finishes.filter((f) => f.exitCode !== 0).length,
    successful: finishes.filter((f) => f.exitCode === 0).length
  };
}

// Find the timestamp of the most recent failing wrapper finish.
function latestFailureTimestamp(outLines) {
  for (let index = outLines.length - 1; index >= 0; index -= 1) {
    const match = outLines[index].match(/^\[(.+)] Mongi monitor wrapper finished with exit code (\d+)\./);

    if (match && Number(match[2]) !== 0) {
      return parseWrapperTimestamp(match[1]);
    }
  }

  return null;
}

function summarizeCompletedRuns(outLines, todayKey, quietHours) {
  const events = {};
  let notificationsSent = 0;
  let quietHoursSuppressionHint = false;

  for (const line of outLines) {
    if (!line.includes("Monitor run completed.") || !isToday(line, todayKey)) {
      continue;
    }

    const summary = parseJsonSuffix(line);

    if (!summary) {
      continue;
    }

    if (Array.isArray(summary.events)) {
      for (const event of summary.events) {
        if (event && event.type) {
          increment(events, event.type);
        }
      }
    }

    if (Number.isFinite(Number(summary.notificationsSent))) {
      notificationsSent += Number(summary.notificationsSent);
    }

    const dispatchableEvents = Array.isArray(summary.events)
      ? summary.events.filter((event) => event && DISPATCHABLE_EVENT_TYPES.has(event.type))
      : [];

    const timestamp = parseLineTimestamp(line);

    if (dispatchableEvents.length > 0 && Number(summary.notificationsSent || 0) === 0 && quietHoursActive(quietHours, timestamp || new Date())) {
      quietHoursSuppressionHint = true;
    }
  }

  return {
    events,
    notificationsSent,
    quietHoursSuppressionHint
  };
}

function recentErrorsCount(outLines, errorLines, todayKey) {
  return [...outLines, ...errorLines]
    .filter((line) => isToday(line, todayKey))
    .filter((line) => /\[(ERROR|WARN)]|failed|not reachable|timeout|expired|permission denied/i.test(line))
    .length;
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

function serviceUsage(state, serviceKey) {
  const service = state && state.services && state.services[serviceKey];
  const source = state && state.sources && state.sources[serviceKey];

  if (!service) {
    return {
      sourceKey: serviceKey,
      backend: source && source.backend || "cdp",
      status: source && source.status || "missing",
      freshness: source && source.freshness || "unknown",
      shortRemaining: null,
      weeklyRemaining: null,
      shortUsed: null,
      weeklyUsed: null,
      shortMeaning: "unknown",
      weeklyMeaning: "unknown",
      shortLabel: null,
      weeklyLabel: null,
      shortResetAt: null,
      weeklyResetAt: null,
      failures: null,
      lastCheckedAt: null,
      lastAttemptedAt: null,
      lastSuccessfulCheckedAt: null,
      lastParseFailedAt: null,
      lastParseFailureReason: null,
      stale: true,
      source: null,
      consecutiveFailures: source && source.consecutiveFailures || null,
      lastFreshReadAt: source && source.lastFreshReadAt || null,
      lastAttemptAt: source && source.lastAttemptAt || null,
      sourceReloadedAt: source && source.sourceReloadedAt || source && source.lastReloadAt || null,
      readAfterReload: source && source.readAfterReload || false,
      candidateCount: source && source.candidateCount || 0,
      exactConfiguredUrlMatch: source && source.exactConfiguredUrlMatch || false,
      sourceUrlGuardPassed: source && source.sourceUrlGuardPassed || false,
      expectedUsageLabelsPresent: source && source.expectedUsageLabelsPresent !== undefined ? source.expectedUsageLabelsPresent : null,
      freshnessDecisionReason: source && source.freshnessDecisionReason || null,
      lastError: source && source.lastError || null,
      lastRecoveryAction: source && source.lastRecoveryAction || null,
      lastReloadAt: source && source.lastReloadAt || null,
      reloadCooldownRemainingMs: source ? cooldownRemainingMs(source, new Date(), DEFAULT_RELOAD_POLICY) : null,
      targetFound: Boolean(source && source.target),
      target: source && source.target || null
    };
  }

  const failures = Number(service.consecutiveParseFailures || 0);
  const lastSuccessfulCheckedAt = service.lastSuccessfulCheckedAt || (failures > 0 ? null : service.lastCheckedAt || null);
  const sourceFailures = Number(source && source.consecutiveFailures || failures || 0);
  const freshness = source && source.freshness || (failures > 0 || !lastSuccessfulCheckedAt ? "stale" : "fresh");

  return {
    sourceKey: serviceKey,
    backend: source && source.backend || "cdp",
    status: source && source.status || (failures > 0 ? "stale" : "healthy"),
    freshness,
    shortRemaining: service.remainingShortWindowPercent,
    weeklyRemaining: service.remainingWeeklyPercent,
    shortUsed: service.usedShortWindowPercent,
    weeklyUsed: service.usedWeeklyPercent,
    shortMeaning: service.rawShortWindowMeaning || "unknown",
    weeklyMeaning: service.rawWeeklyPercentMeaning || "unknown",
    shortLabel: service.shortWindowLabel || null,
    weeklyLabel: service.weeklyWindowLabel || null,
    shortResetAt: service.shortResetAt || service.shortWindowResetAt || null,
    weeklyResetAt: service.weeklyResetAt || service.weeklyWindowResetAt || null,
    failures,
    lastCheckedAt: lastSuccessfulCheckedAt,
    lastAttemptedAt: service.lastAttemptedAt || service.lastCheckedAt || null,
    lastSuccessfulCheckedAt,
    lastParseFailedAt: service.lastParseFailedAt || service.lastParseFailureAt || null,
    lastParseFailureReason: service.lastParseFailureReason || null,
    stale: freshness !== "fresh" || sourceFailures > 0 || !lastSuccessfulCheckedAt,
    source: service.source || null,
    consecutiveFailures: sourceFailures,
    lastFreshReadAt: source && source.lastFreshReadAt || lastSuccessfulCheckedAt,
    lastAttemptAt: source && source.lastAttemptAt || service.lastAttemptedAt || service.lastCheckedAt || null,
    sourceReloadedAt: source && source.sourceReloadedAt || source && source.lastReloadAt || null,
    readAfterReload: source && source.readAfterReload || false,
    candidateCount: source && source.candidateCount || 0,
    exactConfiguredUrlMatch: source && source.exactConfiguredUrlMatch || false,
    sourceUrlGuardPassed: source && source.sourceUrlGuardPassed || false,
    expectedUsageLabelsPresent: source && source.expectedUsageLabelsPresent !== undefined ? source.expectedUsageLabelsPresent : null,
    freshnessDecisionReason: source && source.freshnessDecisionReason || null,
    lastError: source && source.lastError || service.lastParseFailureReason || null,
    lastRecoveryAction: source && source.lastRecoveryAction || null,
    lastReloadAt: source && source.lastReloadAt || null,
    reloadCooldownRemainingMs: source ? cooldownRemainingMs(source, new Date(), DEFAULT_RELOAD_POLICY) : null,
    targetFound: Boolean(source && source.target),
    target: source && source.target || null
  };
}

function missingUsagePage(state, latestSummary, serviceKey) {
  const service = state && state.services && state.services[serviceKey];

  if (service && service.lastParseFailureReason === "usage_page_not_open") {
    return true;
  }

  if (!latestSummary || !Array.isArray(latestSummary.services)) {
    return false;
  }

  return latestSummary.services.some((serviceSummary) => (
    serviceSummary.serviceKey === serviceKey &&
    serviceSummary.errorReason === "usage_page_not_open"
  ));
}

function parserFailuresExist(state) {
  return ["codex", "claude"].some((serviceKey) => {
    const service = state && state.services && state.services[serviceKey];
    const source = state && state.sources && state.sources[serviceKey];
    return (service && Number(service.consecutiveParseFailures || 0) > 0) || (source && Number(source.consecutiveFailures || 0) > 0);
  });
}

function highRecentFailures(state) {
  return ["codex", "claude"].some((serviceKey) => {
    const service = state && state.services && state.services[serviceKey];
    const source = state && state.sources && state.sources[serviceKey];
    const threshold = DEFAULT_RELOAD_POLICY.thresholds[serviceKey] || 3;
    return (service && Number(service.consecutiveParseFailures || 0) >= threshold) || (source && Number(source.consecutiveFailures || 0) >= threshold);
  });
}

function selectOverallStatus(warnings, errors) {
  if (errors.length > 0) {
    return "error";
  }

  if (warnings.length > 0) {
    return "warning";
  }

  return "ok";
}

function selectNextAction(context) {
  if (context.policyError) {
    return "config/policy.json 값이 잘못되었습니다. 설정을 먼저 고치세요.";
  }

  if (!context.envFound) {
    return ".env.example을 기준으로 .env를 만드세요.";
  }

  if (!context.launchdInstalled || !context.launchdLoaded) {
    return "launchd가 로드되지 않았습니다. npm run launchd:install을 실행하세요.";
  }

  if (!context.stateFound && !context.monitorHistoryFound) {
    return "npm run monitor를 실행해 state와 monitor 기록을 만드세요.";
  }

  if (!context.cdpReachable && context.browserMode === "cdp") {
    return "CDP 연결이 끊겼습니다. Mongi Start.app 또는 npm run start:chrome을 실행하세요.";
  }

  if (context.usagePageMissing) {
    return "CDP Chrome에서 Codex/Claude 사용량 페이지가 열려 있는지 확인하세요.";
  }

  if (context.parserFailures) {
    return "npm run debug:page-text로 사용량 페이지를 읽을 수 있는지 확인하세요.";
  }

  if (context.currentlyFailing) {
    return "최근 monitor 실패가 많습니다. npm run logs:summary를 확인하세요.";
  }

  if (context.quietHoursActive) {
    return "급한 조치는 없습니다. 조용한 시간이라 일반 알림은 억제될 수 있습니다.";
  }

  if (context.historyFailuresHigh) {
    return "현재 Mongi는 정상입니다. 오늘 이전 monitor 실패 기록만 남아 있습니다.";
  }

  return "Mongi가 정상 실행 중입니다.";
}

async function buildStatus() {
  const generatedAt = new Date().toISOString();
  const config = loadConfig();
  const policyResult = loadPolicy({ strictJson: false });
  const policy = summarizePolicy(policyResult.policy);
  const statePath = config.stateFilePath;
  const stateFound = exists(statePath);
  const state = stateFound ? readJson(statePath) : null;
  const outLines = readTail(OUT_LOG_PATH).split(/\r?\n/).filter(Boolean);
  const errorLines = readTail(ERROR_LOG_PATH).split(/\r?\n/).filter(Boolean);
  const todayKey = localDateKey();
  const monitor = summarizeMonitor(outLines, todayKey);
  const recentMonitor = summarizeRecentRuns(outLines, RECENT_WINDOW_MINUTES);
  const latestFailureTs = latestFailureTimestamp(outLines);
  const latestFailureAgeMinutes = latestFailureTs
    ? Math.round((Date.now() - latestFailureTs.getTime()) / 60000)
    : null;
  const quietActive = quietHoursActive(policy.quietHours);
  const output = getGitOutputStatus({
    cwd: PROJECT_ROOT,
    now: new Date(generatedAt),
    quietHoursActive: quietActive
  });
  const completed = summarizeCompletedRuns(outLines, todayKey, policy.quietHours);
  const latestFinished = latestMatch(outLines, /^\[(.+)] Mongi monitor wrapper finished with exit code (\d+)\./);
  const latestSummary = latestCompletedSummary(outLines);
  const latestExitCode = latestFinished ? Number(latestFinished[2]) : null;
  const latestRunHealthy = latestExitCode === 0;

  // "Currently failing" = recent window has more failures than successes
  const currentlyFailing = recentMonitor.failed > 0 && recentMonitor.failed >= recentMonitor.successful;
  // "History failures" = all-day had many failures, but latest run is now ok
  const allDayFailuresHigh = monitor.failed > 0 && monitor.failed >= monitor.successful;
  const historyFailuresHigh = allDayFailuresHigh && !currentlyFailing;
  const oldFailuresToday = allDayFailuresHigh ? monitor.failed : 0;

  const loaded = launchdLoaded();
  const cdpOk = await cdpReachable(config.chromeCdpUrl);
  const launchdInstalled = exists(PLIST_PATH);
  const envFound = exists(ENV_PATH);
  const warnings = [...policyResult.warnings];
  const errors = [];
  const historyWarnings = [];
  const codexPageMissing = missingUsagePage(state, latestSummary, "codex");
  const claudePageMissing = missingUsagePage(state, latestSummary, "claude");

  if (policyResult.error) {
    errors.push("policy config cannot be parsed");
  }

  if (!envFound) {
    errors.push(".env missing");
  }

  if (!stateFound && outLines.length === 0) {
    errors.push("state missing and no monitor history found");
  }

  if (!launchdInstalled || !loaded) {
    errors.push("launchd expected but not installed or loaded");
  }

  if (!cdpOk && config.browserConnectionMode === "cdp") {
    warnings.push("CDP is unreachable.");
  }

  if (latestExitCode !== null && latestExitCode !== 0) {
    warnings.push(`Latest monitor exit code is ${latestExitCode}.`);
  }

  // Use recent window for current status, not all-day counts
  if (currentlyFailing) {
    warnings.push("Recent monitor failures are high.");
  } else if (historyFailuresHigh) {
    // Don't affect overallStatus — move to historyWarnings only
    historyWarnings.push(`Earlier today: ${oldFailuresToday} monitor run(s) failed (now resolved).`);
  }

  if (highRecentFailures(state)) {
    warnings.push("Recent parser failures are high.");
  } else if (parserFailuresExist(state)) {
    warnings.push("Parser failures exist.");
  }

  if (codexPageMissing || claudePageMissing) {
    warnings.push("One or more usage pages are missing in the CDP Chrome profile.");
  }

  if (quietActive) {
    warnings.push("Quiet hours are active; normal notifications may be suppressed.");
  }

  const context = {
    policyError: Boolean(policyResult.error),
    envFound,
    launchdInstalled,
    launchdLoaded: loaded,
    stateFound,
    monitorHistoryFound: outLines.length > 0,
    cdpReachable: cdpOk,
    browserMode: config.browserConnectionMode,
    usagePageMissing: codexPageMissing || claudePageMissing,
    parserFailures: parserFailuresExist(state),
    currentlyFailing,
    historyFailuresHigh,
    quietHoursActive: quietActive
  };

  return {
    generatedAt,
    overallStatus: selectOverallStatus(warnings, errors),
    nextAction: selectNextAction(context),
    health: {
      envFound,
      discordWebhookConfigured: Boolean(config.discordWebhookUrl),
      browserMode: config.browserConnectionMode,
      cdpReachable: cdpOk,
      launchdInstalled,
      launchdLoaded: loaded,
      quietHoursActive: quietActive
    },
    output,
    usage: {
      codex: serviceUsage(state, "codex"),
      claude: serviceUsage(state, "claude")
    },
    today: {
      runs: monitor.runs,
      successful: monitor.successful,
      failed: monitor.failed,
      notificationsSent: completed.notificationsSent,
      events: completed.events,
      quietHoursSuppressionHint: completed.quietHoursSuppressionHint,
      latestRun: monitor.latestRun,
      latestExitCode: monitor.latestExitCode,
      recentErrorsCount: recentErrorsCount(outLines, errorLines, todayKey)
    },
    policy: {
      source: policyResult.source,
      ...policy
    },
    warnings: [...errors, ...warnings],
    historyWarnings,
    statusMeta: {
      recentWindowMinutes: RECENT_WINDOW_MINUTES,
      staleWindowMinutes: STALE_WINDOW_MINUTES,
      latestRunHealthy,
      latestFailureAgeMinutes,
      oldFailuresToday
    }
  };
}

if (require.main === module) {
  buildStatus()
    .then((status) => {
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    })
    .catch((error) => {
      const status = {
        generatedAt: new Date().toISOString(),
        overallStatus: "error",
        nextAction: "Inspect status-json failure and rerun npm run status:json.",
        health: {},
        output: null,
        usage: {},
        today: {},
        policy: {},
        warnings: [`status-json failed: ${error.message}`],
        historyWarnings: [],
        statusMeta: null
      };
      process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
      process.exit(1);
    });
}

module.exports = {
  buildStatus
};
