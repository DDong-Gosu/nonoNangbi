const fs = require("fs");

const { monitorLogPath, errorLogPath, ensureRuntimeDirs } = require("../runtime/paths");

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

let fileLoggingDisabled = false;

// Mirror console output into the standard log files. Failures must never crash
// the app: fall back to stderr and stop retrying file writes.
function writeToFile(level, line) {
  if (process.env.MONGI_DISABLE_FILE_LOGGER === "true") {
    return;
  }

  if (fileLoggingDisabled) {
    return;
  }

  try {
    ensureRuntimeDirs();
    fs.appendFileSync(monitorLogPath, `${line}\n`);

    if (level === "error") {
      fs.appendFileSync(errorLogPath, `${line}\n`);
    }
  } catch (error) {
    fileLoggingDisabled = true;
    process.stderr.write(`[logger] file logging disabled: ${error.message}\n`);
  }
}

function getConfiguredLevel() {
  const rawLevel = process.env.LOG_LEVEL || "info";
  const level = String(rawLevel).toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : "info";
}

function shouldLog(level) {
  return LEVELS[level] <= LEVELS[getConfiguredLevel()];
}

function isSensitiveKey(key) {
  return /secret|token|webhook|password|authorization|cookie/i.test(key);
}

function sanitize(value, depth = 0) {
  if (value instanceof Error) {
    const stack = value.stack ? String(value.stack).split("\n").slice(0, 6).join("\n") : undefined;
    return {
      name: value.name,
      message: value.message,
      stack
    };
  }

  if (Array.isArray(value)) {
    return depth >= 4 ? "[Array]" : value.map((item) => sanitize(item, depth + 1));
  }

  if (value && typeof value === "object") {
    if (depth >= 4) {
      return "[Object]";
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSensitiveKey(key) ? "[REDACTED]" : sanitize(item, depth + 1)
      ])
    );
  }

  return value;
}

function formatMetadata(metadata) {
  if (metadata === undefined) {
    return "";
  }

  try {
    return ` ${JSON.stringify(sanitize(metadata))}`;
  } catch (error) {
    return ` ${JSON.stringify({ metadata: "[Unserializable]" })}`;
  }
}

function log(level, message, metadata) {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${formatMetadata(metadata)}`;

  writeToFile(level, line);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

module.exports = {
  info: (message, metadata) => log("info", message, metadata),
  warn: (message, metadata) => log("warn", message, metadata),
  error: (message, metadata) => log("error", message, metadata),
  debug: (message, metadata) => log("debug", message, metadata)
};
