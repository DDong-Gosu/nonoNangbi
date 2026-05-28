const fs = require("fs");
const path = require("path");
const { commandsPath, ensureRuntimeDirs } = require("./paths");

function nowIso() {
  return new Date().toISOString();
}

function normalizeCommand(command) {
  if (!command || typeof command !== "object") {
    return null;
  }

  const id = typeof command.id === "string" && command.id.trim().length > 0
    ? command.id.trim()
    : null;
  const type = typeof command.type === "string" && command.type.trim().length > 0
    ? command.type.trim()
    : null;

  if (!id || !type) {
    return null;
  }

  return {
    id,
    type,
    source: typeof command.source === "string" ? command.source : null,
    createdAt: typeof command.createdAt === "string" ? command.createdAt : null,
    processedAt: typeof command.processedAt === "string" ? command.processedAt : null,
    status: typeof command.status === "string" ? command.status : null,
    result: typeof command.result === "string" ? command.result : null
  };
}

function normalizeStore(value) {
  const rawCommands = Array.isArray(value)
    ? value
    : value && Array.isArray(value.commands)
      ? value.commands
      : [];

  return {
    version: 1,
    updatedAt: value && typeof value.updatedAt === "string" ? value.updatedAt : null,
    commands: rawCommands.map(normalizeCommand).filter(Boolean)
  };
}

function backupCorruptFile(filePath, logger) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const backupPath = `${filePath}.corrupt.${Date.now()}`;
  try {
    fs.renameSync(filePath, backupPath);
    if (logger && logger.warn) {
      logger.warn("Command file was corrupt and has been backed up.", { backupPath });
    }
  } catch (error) {
    if (logger && logger.warn) {
      logger.warn("Failed to back up corrupt command file.", { error: error.message });
    }
  }
}

function readCommandStore(filePath = commandsPath, logger = null) {
  ensureRuntimeDirs();

  if (!fs.existsSync(filePath)) {
    return { version: 1, updatedAt: null, commands: [] };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (raw.trim().length === 0) {
      return { version: 1, updatedAt: null, commands: [] };
    }
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    if (logger && logger.warn) {
      logger.warn("Failed to read command file.", { error: error.message });
    }
    backupCorruptFile(filePath, logger);
    return { version: 1, updatedAt: null, commands: [] };
  }
}

function writeCommandStore(store, filePath = commandsPath) {
  ensureRuntimeDirs();
  const normalized = normalizeStore(store);
  normalized.updatedAt = nowIso();
  const directory = path.dirname(filePath);
  const tempPath = path.join(directory, `.commands.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
  return normalized;
}

function pendingCommands(store) {
  return normalizeStore(store).commands.filter((command) => !command.processedAt && command.status !== "processed");
}

function completeCommands(commandIds, result, filePath = commandsPath, logger = null) {
  if (!Array.isArray(commandIds) || commandIds.length === 0) {
    return readCommandStore(filePath, logger);
  }

  const ids = new Set(commandIds);
  const store = readCommandStore(filePath, logger);
  const processedAt = nowIso();

  store.commands = store.commands.map((command) => {
    if (!ids.has(command.id)) {
      return command;
    }

    return {
      ...command,
      processedAt,
      status: result && result.status ? result.status : "processed",
      result: result && result.result ? result.result : "processed by monitor"
    };
  });

  return writeCommandStore(store, filePath);
}

module.exports = {
  completeCommands,
  pendingCommands,
  readCommandStore,
  writeCommandStore
};
