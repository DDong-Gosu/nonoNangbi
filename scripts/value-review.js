const fs = require("fs");
const path = require("path");

const { loadConfig } = require("../src/config");
const { loadPolicy, summarizePolicy } = require("../src/policy/policyStore");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-out.log");
const ERROR_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-error.log");
const DECISION_OPTIONS = ["keep", "keep_but_adjust", "pause_or_downgrade", "cancel"];
const CHECKLIST = [
  "Did you ship code this week?",
  "Did you create docs, specs, or review notes?",
  "Did Codex solve repo work that moved a project forward?",
  "Did Claude clarify planning, writing, or reasoning-heavy work?",
  "Did any Mongi alert lead to a real development action?",
  "Can you name at least two concrete artifacts from paid AI usage?",
  "Did you avoid repeating the same question without saving an output?"
];
const CODEX_ROLE_QUESTIONS = [
  "What repo work did Codex directly change?",
  "Which bug, test, refactor, or implementation task did Codex help finish?",
  "Did Codex reduce time from problem to working code?",
  "Was Codex used for execution rather than long planning talk?",
  "What should Codex handle less or more next week?"
];
const CLAUDE_ROLE_QUESTIONS = [
  "What spec, plan, review, or long-form reasoning did Claude clarify?",
  "Did Claude turn vague intent into a concrete next step?",
  "Did Claude produce reusable docs, notes, or decision structure?",
  "Was Claude used for planning/review instead of avoiding implementation?",
  "What should Claude handle less or more next week?"
];
const WEEKLY_QUESTIONS = [
  "What shipped or became clearer this week?",
  "Which paid tool created the most concrete output?",
  "Which alert actually changed your behavior?",
  "Where did usage become wandering instead of output?",
  "What is one policy or role adjustment for next week?"
];
const MONTHLY_QUESTIONS = [
  "Did Codex produce enough repo progress to justify keeping it?",
  "Did Claude produce enough planning, writing, or reasoning value to justify keeping it?",
  "Did the combined subscription produce project milestones, not just usage?",
  "Which tool would you miss next month if removed?",
  "Should either tool be kept, adjusted, paused, downgraded, or canceled?"
];

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

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "unknown" : String(value);
}

function serviceUsage(state, serviceKey) {
  const service = state && state.services && state.services[serviceKey];

  if (!service) {
    return {
      shortRemaining: null,
      weeklyRemaining: null,
      failures: null,
      lastCheckedAt: null
    };
  }

  return {
    shortRemaining: service.remainingShortWindowPercent,
    weeklyRemaining: service.remainingWeeklyPercent,
    failures: Number(service.consecutiveParseFailures || 0),
    lastCheckedAt: service.lastCheckedAt || null
  };
}

function summarizeLogs(outLines, errorLines) {
  const startedDates = new Set();
  const completedDates = new Set();
  const finished = [];
  const events = {};
  const serviceOk = {
    codex: 0,
    claude: 0
  };
  const serviceFailures = {
    codex: 0,
    claude: 0
  };
  let notificationsSent = 0;
  let completedRuns = 0;

  for (const line of outLines) {
    const startMatch = line.match(/^\[(.+)] Mongi monitor wrapper started\./);
    const finishMatch = line.match(/^\[(.+)] Mongi monitor wrapper finished with exit code (\d+)\./);

    if (startMatch) {
      const timestamp = parseWrapperTimestamp(startMatch[1]);

      if (timestamp) {
        startedDates.add(localDateKey(timestamp));
      }
    }

    if (finishMatch) {
      const timestamp = parseWrapperTimestamp(finishMatch[1]);

      if (timestamp) {
        finished.push({
          timestamp,
          exitCode: Number(finishMatch[2])
        });
      }
    }

    if (!line.includes("Monitor run completed.")) {
      continue;
    }

    const timestamp = parseLineTimestamp(line);
    const summary = parseJsonSuffix(line);

    if (timestamp) {
      completedDates.add(localDateKey(timestamp));
    }

    if (!summary) {
      continue;
    }

    completedRuns += 1;

    if (Array.isArray(summary.events)) {
      for (const event of summary.events) {
        if (event && event.type) {
          increment(events, event.type);
        }
      }
    }

    if (Array.isArray(summary.services)) {
      for (const service of summary.services) {
        if (!service || !service.serviceKey || !Object.prototype.hasOwnProperty.call(serviceOk, service.serviceKey)) {
          continue;
        }

        if (service.ok) {
          serviceOk[service.serviceKey] += 1;
        } else {
          serviceFailures[service.serviceKey] += 1;
        }
      }
    }

    if (Number.isFinite(Number(summary.notificationsSent))) {
      notificationsSent += Number(summary.notificationsSent);
    }
  }

  const recentErrorCount = [...outLines, ...errorLines]
    .filter((line) => /\[(ERROR|WARN)]|failed|not reachable|timeout|expired|permission denied/i.test(line))
    .length;
  const latestFinish = finished[finished.length - 1] || null;
  const successfulRuns = finished.filter((finish) => finish.exitCode === 0).length;
  const failedRuns = finished.filter((finish) => finish.exitCode !== 0).length;
  const totalRuns = finished.length;

  return {
    monitorDays: Array.from(new Set([...startedDates, ...completedDates])).sort(),
    completedDays: Array.from(completedDates).sort(),
    totalRuns,
    completedRuns,
    successfulRuns,
    failedRuns,
    successRate: totalRuns > 0 ? Number(((successfulRuns / totalRuns) * 100).toFixed(1)) : null,
    latestRunAt: latestFinish ? latestFinish.timestamp.toISOString() : null,
    latestExitCode: latestFinish ? latestFinish.exitCode : null,
    recentErrorCount,
    events,
    notificationsSent,
    serviceOk,
    serviceFailures
  };
}

function buildSuggestedDecision(summary) {
  const enoughDays = summary.reliability.monitorDaysCount >= 3;
  const enoughRuns = summary.reliability.completedRuns >= 3;
  const hasEventsOrNotifications = summary.notifications.sent > 0 || Object.keys(summary.events).length > 0;

  if (!enoughDays || !enoughRuns || !hasEventsOrNotifications) {
    return {
      status: "not_enough_data",
      reason: "Complete 3-5 days of usage records before deciding."
    };
  }

  return {
    status: "manual_review_required",
    reason: "Monitor data exists, but record actual weekly/monthly outputs before choosing keep, adjust, pause, or cancel.",
    cautiousDefault: "keep_but_adjust"
  };
}

function buildReview() {
  const config = loadConfig();
  const policyResult = loadPolicy({ strictJson: false });
  const policy = summarizePolicy(policyResult.policy);
  const statePath = path.resolve(PROJECT_ROOT, config.stateFilePath);
  const state = readJson(statePath);
  const outLines = readTail(OUT_LOG_PATH).split(/\r?\n/).filter(Boolean);
  const errorLines = readTail(ERROR_LOG_PATH).split(/\r?\n/).filter(Boolean);
  const logSummary = summarizeLogs(outLines, errorLines);
  const review = {
    generatedAt: new Date().toISOString(),
    usage: {
      codex: serviceUsage(state, "codex"),
      claude: serviceUsage(state, "claude")
    },
    reliability: {
      monitorDaysCount: logSummary.monitorDays.length,
      completedDaysCount: logSummary.completedDays.length,
      monitorDays: logSummary.monitorDays.slice(-7),
      totalRuns: logSummary.totalRuns,
      completedRuns: logSummary.completedRuns,
      successfulRuns: logSummary.successfulRuns,
      failedRuns: logSummary.failedRuns,
      successRate: logSummary.successRate,
      latestRunAt: logSummary.latestRunAt,
      latestExitCode: logSummary.latestExitCode,
      recentErrorCount: logSummary.recentErrorCount,
      serviceOk: logSummary.serviceOk,
      serviceFailures: logSummary.serviceFailures
    },
    events: logSummary.events,
    notifications: {
      sent: logSummary.notificationsSent
    },
    checklist: CHECKLIST,
    codexRoleQuestions: CODEX_ROLE_QUESTIONS,
    claudeRoleQuestions: CLAUDE_ROLE_QUESTIONS,
    weeklyQuestions: WEEKLY_QUESTIONS,
    monthlyQuestions: MONTHLY_QUESTIONS,
    decisionOptions: DECISION_OPTIONS,
    policy: {
      source: policyResult.source,
      messageIntensity: policy.message.intensity,
      quietHours: policy.quietHours
    },
    warnings: policyResult.warnings
  };

  review.suggestedDecision = buildSuggestedDecision(review);
  return review;
}

function printList(items) {
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function printReview(review) {
  console.log("Mongi Value Review");
  console.log("");
  console.log("Usage snapshot:");
  console.log(`- Codex remaining: short ${formatValue(review.usage.codex.shortRemaining)}, weekly ${formatValue(review.usage.codex.weeklyRemaining)}, failures ${formatValue(review.usage.codex.failures)}`);
  console.log(`- Claude remaining: short ${formatValue(review.usage.claude.shortRemaining)}, weekly ${formatValue(review.usage.claude.weeklyRemaining)}, failures ${formatValue(review.usage.claude.failures)}`);
  console.log("");
  console.log("Monitor reliability:");
  console.log(`- monitor days: ${review.reliability.monitorDaysCount}`);
  console.log(`- completed runs: ${review.reliability.completedRuns}`);
  console.log(`- successful runs: ${review.reliability.successfulRuns}`);
  console.log(`- failed runs: ${review.reliability.failedRuns}`);
  console.log(`- success rate: ${review.reliability.successRate === null ? "unknown" : `${review.reliability.successRate}%`}`);
  console.log(`- latest exit code: ${formatValue(review.reliability.latestExitCode)}`);
  console.log("");
  console.log("Event/notification summary:");
  console.log(`- notifications sent: ${review.notifications.sent}`);

  if (Object.keys(review.events).length === 0) {
    console.log("- events: none detected");
  } else {
    for (const key of Object.keys(review.events).sort()) {
      console.log(`- ${key}: ${review.events[key]}`);
    }
  }

  console.log("");
  console.log("Output checklist:");
  printList(review.checklist);
  console.log("");
  console.log("Codex role review:");
  printList(review.codexRoleQuestions);
  console.log("");
  console.log("Claude role review:");
  printList(review.claudeRoleQuestions);
  console.log("");
  console.log("Weekly review questions:");
  printList(review.weeklyQuestions);
  console.log("");
  console.log("Monthly decision questions:");
  printList(review.monthlyQuestions);
  console.log("");
  console.log("Suggested decision placeholder:");
  console.log(`- status: ${review.suggestedDecision.status}`);
  console.log(`- reason: ${review.suggestedDecision.reason}`);
  console.log(`- options: ${review.decisionOptions.join(", ")}`);
}

try {
  const review = buildReview();

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(review, null, 2)}\n`);
  } else {
    printReview(review);
  }
} catch (error) {
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify({
      generatedAt: new Date().toISOString(),
      usage: {},
      reliability: {},
      events: {},
      notifications: {},
      checklist: CHECKLIST,
      codexRoleQuestions: CODEX_ROLE_QUESTIONS,
      claudeRoleQuestions: CLAUDE_ROLE_QUESTIONS,
      weeklyQuestions: WEEKLY_QUESTIONS,
      monthlyQuestions: MONTHLY_QUESTIONS,
      decisionOptions: DECISION_OPTIONS,
      suggestedDecision: {
        status: "error",
        reason: `Value review failed: ${error.message}`
      },
      warnings: [`Value review failed: ${error.message}`]
    }, null, 2)}\n`);
  } else {
    console.error(`Value review failed: ${error.message}`);
  }

  process.exit(1);
}
