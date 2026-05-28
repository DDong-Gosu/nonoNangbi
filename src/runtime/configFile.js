const fs = require("fs");

const { configPath } = require("./paths");

// V3 config.json is groundwork for later phases. The app must run on defaults
// when the file is absent or unreadable; never crash because config is missing.
const DEFAULT_CONFIG = {
  version: 1,
  pollIntervalMs: 60000,
  enabledSources: {
    codex: true,
    claude: true
  },
  backend: {
    codex: "cdp",
    claude: "cdp"
  }
};

function getDefaultConfigFile() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeWithDefaults(local) {
  const defaults = getDefaultConfigFile();

  if (!isPlainObject(local)) {
    return { config: defaults, source: "default" };
  }

  return {
    config: {
      ...defaults,
      ...local,
      enabledSources: { ...defaults.enabledSources, ...(local.enabledSources || {}) },
      backend: { ...defaults.backend, ...(local.backend || {}) }
    },
    source: "local"
  };
}

function loadConfigFile(filePath = configPath) {
  if (!fs.existsSync(filePath)) {
    return { config: getDefaultConfigFile(), source: "default", path: filePath };
  }

  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return {
      config: getDefaultConfigFile(),
      source: "default-with-invalid-local",
      path: filePath,
      error: { message: error.message }
    };
  }

  const merged = mergeWithDefaults(parsed);
  return { config: merged.config, source: merged.source, path: filePath };
}

module.exports = {
  DEFAULT_CONFIG,
  getDefaultConfigFile,
  loadConfigFile
};
