const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-out.log");
const ERROR_LOG_PATH = path.join(PROJECT_ROOT, "logs/launchd-error.log");

function readTail(filePath, maxBytes = 512 * 1024) {
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

function lastMatch(lines, pattern) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = lines[index].match(pattern);

    if (match) {
      return match;
    }
  }

  return null;
}

function lastLineIncluding(lines, text) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].includes(text)) {
      return lines[index];
    }
  }

  return null;
}

function lastIndexIncluding(lines, text) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].includes(text)) {
      return index;
    }
  }

  return -1;
}

function recentErrorLines(lines) {
  return lines
    .filter((line) => /\[(ERROR|WARN)]|failed|not reachable/i.test(line))
    .slice(-10);
}

function summarizeServices(summary) {
  if (!summary || !Array.isArray(summary.services)) {
    return "unknown";
  }

  return summary.services
    .map((service) => {
      const status = service.ok ? "ok" : "failed";
      const short = service.remainingShortWindowPercent ?? "unknown";
      const weekly = service.remainingWeeklyPercent ?? "unknown";
      const reason = service.errorReason ? `, reason ${service.errorReason}` : "";
      return `${service.serviceKey}: ${status}, short ${short}, weekly ${weekly}${reason}`;
    })
    .join("; ");
}

function summarizeEvents(summary) {
  if (!summary || !Array.isArray(summary.events)) {
    return "unknown";
  }

  if (summary.events.length === 0) {
    return "none";
  }

  return summary.events.map((event) => `${event.type}:${event.serviceKey}`).join(", ");
}

function main() {
  const outExists = fs.existsSync(OUT_LOG_PATH);
  const errorExists = fs.existsSync(ERROR_LOG_PATH);
  const outLines = readTail(OUT_LOG_PATH).split(/\r?\n/).filter(Boolean);
  const errorLines = readTail(ERROR_LOG_PATH).split(/\r?\n/).filter(Boolean);
  const started = lastMatch(outLines, /^\[(.+)] Mongi monitor wrapper started\./);
  const finished = lastMatch(outLines, /^\[(.+)] Mongi monitor wrapper finished with exit code (\d+)\./);
  const completedLine = lastLineIncluding(outLines, "Monitor run completed.");
  const completedSummary = completedLine ? parseJsonSuffix(completedLine) : null;
  const cdpReadyIndex = lastIndexIncluding(outLines, "Browser context ready for monitor.");
  const connectionFailureIndex = lastIndexIncluding(outLines, "Browser connection failed:");
  const errors = recentErrorLines([...outLines, ...errorLines]);
  const lastCdpReachable = cdpReadyIndex === -1 && connectionFailureIndex === -1
    ? "unknown"
    : cdpReadyIndex > connectionFailureIndex
      ? "yes"
      : "no";

  console.log("Mongi Launchd Log Summary");
  console.log("");

  if (!outExists && !errorExists) {
    console.log("No launchd logs found.");
    console.log("Generate logs with: npm run launchd:install");
    console.log("Or run once with: npm run monitor:run");
    return;
  }

  console.log(`Out log: ${outExists ? OUT_LOG_PATH : "missing"}`);
  console.log(`Error log: ${errorExists ? ERROR_LOG_PATH : "missing"}`);
  console.log(`Last wrapper started: ${started ? started[1] : "unknown"}`);
  console.log(`Last wrapper finished: ${finished ? finished[1] : "unknown"}`);
  console.log(`Last exit code: ${finished ? finished[2] : "unknown"}`);
  console.log(`Last monitor completed: ${completedLine ? "yes" : "no"}`);
  console.log(`CDP reachable in last monitor: ${lastCdpReachable}`);
  console.log(`Services: ${summarizeServices(completedSummary)}`);
  console.log(`Events: ${summarizeEvents(completedSummary)}`);
  console.log(`Notifications sent: ${completedSummary && completedSummary.notificationsSent !== undefined ? completedSummary.notificationsSent : "unknown"}`);

  if (errors.length > 0) {
    console.log("");
    console.log("Recent error/warn lines:");
    for (const line of errors) {
      console.log(`- ${line}`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(`Log summary failed: ${error.message}`);
  process.exit(1);
}
