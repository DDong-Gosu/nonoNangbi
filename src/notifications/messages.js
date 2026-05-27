const { OUTPUT_STATUSES } = require("../output/gitOutputStatus");

const STATUS_LINES = Object.freeze({
  [OUTPUT_STATUSES.NO_OUTPUT]: "Git: shipped/local output 감지 없음. 작은 변경 하나 시작.",
  [OUTPUT_STATUSES.LOCAL_ONLY]: "Git: local work 있음. 오늘 push까지 닫기.",
  [OUTPUT_STATUSES.SHIPPED]: "Git: 오늘 shipped evidence 감지됨. 다음 작은 마감 정리."
});

function normalizeOutputStatus(value) {
  return Object.values(OUTPUT_STATUSES).includes(value) ? value : OUTPUT_STATUSES.NO_OUTPUT;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string" && /^\d+(?:\.\d+)?%$/.test(value.trim())) {
    return value.trim();
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return `${String(value)}%`;
}

function servicePercent(service, shortKeys, weeklyKeys) {
  if (!service || typeof service !== "object") {
    return null;
  }

  let short = null;
  let weekly = null;

  for (const key of shortKeys) {
    short = formatPercent(service[key]);

    if (short) {
      break;
    }
  }

  for (const key of weeklyKeys) {
    weekly = formatPercent(service[key]);

    if (weekly) {
      break;
    }
  }

  if (!short && !weekly) {
    return null;
  }

  return `S${short || "?"}/W${weekly || "?"}`;
}

function normalizeUsage(usage = {}) {
  return {
    codex: servicePercent(usage.codex, ["shortRemaining", "remainingShortWindowPercent", "remainingShortWindow"], ["weeklyRemaining", "remainingWeeklyPercent", "remainingWeekly"]),
    claude: servicePercent(usage.claude, ["shortRemaining", "remainingShortWindowPercent", "remainingShortWindow"], ["weeklyRemaining", "remainingWeeklyPercent", "remainingWeekly"])
  };
}

function formatUsageLine(usage = {}) {
  const normalized = normalizeUsage(usage);
  const parts = [];

  if (normalized.codex) {
    parts.push(`Codex ${normalized.codex}`);
  }

  if (normalized.claude) {
    parts.push(`Claude ${normalized.claude}`);
  }

  return parts.length > 0 ? `Usage remaining: ${parts.join(", ")}` : null;
}

function lineCount(message) {
  return String(message).split(/\r?\n/).filter((line) => line.length > 0).length;
}

function ensureThreeLines(message) {
  if (lineCount(message) > 3) {
    throw new Error("Discord message exceeds 3 lines.");
  }

  return message;
}

function getOutputStatusMessage({ output = {}, usage = {} } = {}) {
  const outputStatus = normalizeOutputStatus(output.outputStatus);
  const lines = [
    outputStatus,
    STATUS_LINES[outputStatus]
  ];
  const usageLine = formatUsageLine(usage);

  if (usageLine) {
    lines.push(usageLine);
  }

  return ensureThreeLines(lines.join("\n"));
}

function getStartMessage({ output = {}, checkIntervalMinutes = null } = {}) {
  const outputStatus = normalizeOutputStatus(output.outputStatus);
  const cadence = Number.isFinite(Number(checkIntervalMinutes)) && Number(checkIntervalMinutes) > 0
    ? `${Number(checkIntervalMinutes)}분마다 확인`
    : "cadence 미설정";

  return ensureThreeLines([
    "Mongi started",
    `Watching Git output: ${outputStatus}`,
    `Cadence: ${cadence}`
  ].join("\n"));
}

function getTestMessage(context = {}) {
  return getStartMessage(context);
}

function getEventMessage(event, variables = {}) {
  return getOutputStatusMessage({
    output: variables.output || event.output || { outputStatus: event.outputStatus },
    usage: variables.usage || event.usage || {}
  });
}

module.exports = {
  STATUS_LINES,
  ensureThreeLines,
  formatUsageLine,
  getEventMessage,
  getOutputStatusMessage,
  getStartMessage,
  getTestMessage,
  lineCount,
  normalizeOutputStatus
};
