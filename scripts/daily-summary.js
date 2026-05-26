const fs = require("fs");
const path = require("path");

const { loadConfig } = require("../src/config");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const STATE_PATH = path.join(PROJECT_ROOT, "data/state.json");
const OUT_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-out.log");
const ERROR_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-error.log");
const PROJECT_NAME = "Mongi Usage Coach";
const DISPATCHABLE_EVENT_TYPES = new Set([
  "recovered_short",
  "recovered_weekly",
  "session_stopped",
  "weekly_idle",
  "parse_failure_digest",
  "cdp_unreachable_digest"
]);

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

function formatLocalDateTime(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return `${localDateKey(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseWrapperTimestamp(value) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);

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

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "unknown" : String(value);
}

function increment(counts, key, amount = 1) {
  counts[key] = (counts[key] || 0) + amount;
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
    latestRunAt: latestFinish ? latestFinish.timestamp : latestStart && latestStart.timestamp,
    latestExitCode: latestFinish ? latestFinish.exitCode : null
  };
}

function summarizeCompletedRuns(outLines, todayKey, config) {
  const eventCounts = {};
  let notificationsSent = 0;
  let quietSuppressionLikely = false;
  let completedRuns = 0;

  for (const line of outLines) {
    if (!line.includes("Monitor run completed.") || !isToday(line, todayKey)) {
      continue;
    }

    const summary = parseJsonSuffix(line);

    if (!summary) {
      continue;
    }

    completedRuns += 1;

    if (Array.isArray(summary.events)) {
      for (const event of summary.events) {
        if (event && event.type) {
          increment(eventCounts, event.type);
        }
      }
    }

    if (Number.isFinite(Number(summary.notificationsSent))) {
      notificationsSent += Number(summary.notificationsSent);
    }

    const timestamp = parseLineTimestamp(line);
    const dispatchableEvents = Array.isArray(summary.events)
      ? summary.events.filter((event) => event && DISPATCHABLE_EVENT_TYPES.has(event.type))
      : [];

    if (dispatchableEvents.length > 0 && Number(summary.notificationsSent || 0) === 0 && isQuietHours(config, timestamp || new Date())) {
      quietSuppressionLikely = true;
    }
  }

  return {
    completedRuns,
    eventCounts,
    notificationsSent,
    quietSuppressionLikely
  };
}

function isQuietHours(config, now = new Date()) {
  if (!config.quietHours || !config.quietHours.enabled) {
    return false;
  }

  const hour = now.getHours();
  const start = config.quietHours.startHour;
  const end = config.quietHours.endHour;

  if (start === end) {
    return true;
  }

  if (start < end) {
    return hour >= start && hour < end;
  }

  return hour >= start || hour < end;
}

function sanitizeLogLine(line) {
  const jsonStart = line.indexOf(" {");
  const summary = jsonStart === -1 ? line : line.slice(0, jsonStart);

  return summary
    .replace(/https:\/\/(?:canary\.)?discord(?:app)?\.com\/api\/webhooks\/\S+/gi, "[REDACTED_DISCORD_WEBHOOK]")
    .replace(/DISCORD_WEBHOOK_URL=\S+/gi, "DISCORD_WEBHOOK_URL=[REDACTED]")
    .replace(/(authorization|cookie|token|password)["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[REDACTED]")
    .slice(0, 260);
}

function summarizeErrors(outLines, errorLines, todayKey) {
  return [...outLines, ...errorLines]
    .filter((line) => isToday(line, todayKey))
    .filter((line) => /\[(ERROR|WARN)]|failed|not reachable|timeout|expired|permission denied/i.test(line))
    .slice(-5)
    .map(sanitizeLogLine);
}

function serviceSummary(state, serviceKey) {
  const service = state && state.services && state.services[serviceKey];

  if (!service) {
    return {
      missing: true
    };
  }

  return {
    missing: false,
    short: service.remainingShortWindowPercent,
    weekly: service.remainingWeeklyPercent,
    failures: Number(service.consecutiveParseFailures || 0),
    failureReason: service.lastParseFailureReason || null,
    lastCheckedAt: service.lastCheckedAt || null
  };
}

function printService(label, summary) {
  if (summary.missing) {
    console.log(`- ${label}: missing`);
    console.log("  Next: Run npm run monitor to create service state.");
    return;
  }

  const failureText = summary.failureReason
    ? `${summary.failures} (${summary.failureReason})`
    : String(summary.failures);

  console.log(`- ${label} remaining: short ${formatValue(summary.short)}, weekly ${formatValue(summary.weekly)}`);
  console.log(`  failures: ${failureText}`);
  console.log(`  lastCheckedAt: ${formatValue(summary.lastCheckedAt)}`);
}

function printCounts(counts) {
  const keys = ["usage_active", "session_stopped", "weekly_idle", "recovered_short", "recovered_weekly", "parse_failure_digest", "cdp_unreachable_digest"];
  let printed = false;

  for (const key of keys) {
    if (counts[key]) {
      console.log(`- ${key}: ${counts[key]}`);
      printed = true;
    }
  }

  for (const key of Object.keys(counts).sort()) {
    if (!keys.includes(key)) {
      console.log(`- ${key}: ${counts[key]}`);
      printed = true;
    }
  }

  if (!printed) {
    console.log("- none detected");
  }
}

const REVIEW_QUESTIONS = [
  "Did any Mongi alert make you start or resume development?",
  "What artifact did you produce today?",
  "Did any notification feel annoying or mistimed?",
  "Did Codex/Claude usage turn into output?"
];

function buildDailySummary() {
  const config = loadConfig();
  const todayKey = localDateKey();
  const stateExists = fs.existsSync(STATE_PATH);
  const outExists = fs.existsSync(OUT_LOG_PATH);
  const errorExists = fs.existsSync(ERROR_LOG_PATH);
  const state = stateExists ? readJson(STATE_PATH) : null;
  const outLines = readTail(OUT_LOG_PATH).split(/\r?\n/).filter(Boolean);
  const errorLines = readTail(ERROR_LOG_PATH).split(/\r?\n/).filter(Boolean);
  const monitor = summarizeMonitor(outLines, todayKey);
  const completed = summarizeCompletedRuns(outLines, todayKey, config);
  const errors = summarizeErrors(outLines, errorLines, todayKey);

  return {
    date: todayKey,
    project: PROJECT_NAME,
    runs: monitor.runs,
    successful: monitor.successful,
    failed: monitor.failed,
    latestRun: monitor.latestRunAt ? monitor.latestRunAt.toISOString() : null,
    latestExitCode: monitor.latestExitCode,
    usage: {
      codex: serviceSummary(state, "codex"),
      claude: serviceSummary(state, "claude")
    },
    events: completed.eventCounts,
    notificationsSent: completed.notificationsSent,
    quietHoursSuppressionHint: completed.quietSuppressionLikely,
    recentErrorsCount: errors.length,
    recentErrors: errors,
    reviewQuestions: REVIEW_QUESTIONS,
    files: {
      stateFound: stateExists,
      outLogFound: outExists,
      errorLogFound: errorExists
    }
  };
}

function main() {
  const summary = buildDailySummary();

  console.log(`Mongi Daily Summary — ${summary.date}`);
  console.log(`Project: ${summary.project}`);
  console.log("");

  console.log("Monitor:");
  console.log(`- Total wrapper runs detected today: ${summary.runs}`);
  console.log(`- Successful runs: ${summary.successful}`);
  console.log(`- Failed runs: ${summary.failed}`);
  console.log(`- Latest run timestamp: ${formatLocalDateTime(summary.latestRun ? new Date(summary.latestRun) : null)}`);
  console.log(`- Latest exit code: ${formatValue(summary.latestExitCode)}`);

  if (!summary.files.outLogFound) {
    console.log("- Next: logs/launchd-out.log is missing. Run npm run launchd:install or npm run monitor:run.");
  }

  console.log("");
  console.log("Usage:");

  if (!summary.files.stateFound) {
    console.log("- state: missing or unreadable");
    console.log("- Next: Run npm run monitor or npm run test:state to create data/state.json.");
  } else {
    printService("Codex", summary.usage.codex);
    printService("Claude", summary.usage.claude);
  }

  console.log("");
  console.log("Events:");
  printCounts(summary.events);

  console.log("");
  console.log("Notifications:");
  console.log(`- total notificationsSent detected today: ${summary.notificationsSent}`);
  console.log(`- quiet hours suppression hint: ${summary.quietHoursSuppressionHint ? "yes" : "no"}`);

  console.log("");
  console.log("Errors:");

  if (!summary.files.errorLogFound) {
    console.log("- logs/launchd-error.log is missing.");
    console.log("- Next: Run npm run launchd:install or npm run monitor:run.");
  } else if (summary.recentErrors.length === 0) {
    console.log("- none detected today");
  } else {
    for (const line of summary.recentErrors) {
      console.log(`- ${line}`);
    }
  }

  console.log("");
  console.log("Review questions:");
  for (const question of summary.reviewQuestions) {
    console.log(`- ${question}`);
  }
}

function toJsonSummary(summary) {
  return {
    date: summary.date,
    runs: summary.runs,
    successful: summary.successful,
    failed: summary.failed,
    latestRun: summary.latestRun,
    latestExitCode: summary.latestExitCode,
    usage: summary.usage,
    events: summary.events,
    notificationsSent: summary.notificationsSent,
    quietHoursSuppressionHint: summary.quietHoursSuppressionHint,
    recentErrorsCount: summary.recentErrorsCount,
    reviewQuestions: summary.reviewQuestions
  };
}

try {
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(toJsonSummary(buildDailySummary()), null, 2)}\n`);
  } else {
    main();
  }
} catch (error) {
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({
      date: localDateKey(),
      runs: 0,
      successful: 0,
      failed: 0,
      latestRun: null,
      latestExitCode: null,
      usage: {},
      events: {},
      notificationsSent: 0,
      quietHoursSuppressionHint: false,
      recentErrorsCount: 1,
      reviewQuestions: REVIEW_QUESTIONS,
      warnings: [`Daily summary failed: ${error.message}`]
    }, null, 2)}\n`);
  } else {
    console.error(`Daily summary failed: ${error.message}`);
  }
  process.exit(1);
}
