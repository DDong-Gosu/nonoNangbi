const { OUTPUT_STATUSES, getOutputStatusDisplay } = require("../output/gitOutputStatus");

const STATUS_LINES = Object.freeze({
  [OUTPUT_STATUSES.NO_OUTPUT]: "로컬 변경/푸시가 아직 없음.",
  [OUTPUT_STATUSES.LOCAL_ONLY]: "아직 푸시 안 됨. 오늘 하나 올리자.",
  [OUTPUT_STATUSES.SHIPPED]: "GitHub 산출물 감지됨."
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

function formatPercentNumber(value) {
  const percent = formatPercent(value);

  if (!percent) {
    return null;
  }

  return percent.replace(/%$/, "");
}

function servicePercent(service, shortKeys, weeklyKeys) {
  if (!service || typeof service !== "object") {
    return null;
  }

  if (Number(service.failures || service.consecutiveParseFailures || 0) > 0 || service.stale === true) {
    return null;
  }

  let short = null;
  let weekly = null;

  for (const key of shortKeys) {
    short = formatPercentNumber(service[key]);

    if (short) {
      break;
    }
  }

  for (const key of weeklyKeys) {
    weekly = formatPercentNumber(service[key]);

    if (weekly) {
      break;
    }
  }

  if (!short && !weekly) {
    return null;
  }

  return `${short || "?"}/${weekly || "?"}`;
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

  return parts.length > 0 ? `${parts.join(" · ")} 남음` : null;
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
  const display = getOutputStatusDisplay(outputStatus);
  const lines = [
    `몽이 · ${display.label}`,
    STATUS_LINES[outputStatus]
  ];
  const usageLine = formatUsageLine(usage);

  if (usageLine) {
    lines.push(usageLine);
  }

  return ensureThreeLines(lines.join("\n"));
}

function getStartMessage({ output = {}, checkIntervalMinutes = null } = {}) {
  const cadence = Number.isFinite(Number(checkIntervalMinutes)) && Number(checkIntervalMinutes) > 0
    ? `${Number(checkIntervalMinutes)}분마다 조용히 확인`
    : "조용히 상태만 확인";

  return ensureThreeLines([
    "몽이 · Mongi 시작",
    cadence,
    "알림은 필요한 경우만 전송"
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
