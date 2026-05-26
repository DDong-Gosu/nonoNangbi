const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const DEFAULTS = {
  codexUsageUrl: "https://chatgpt.com/codex/cloud/settings/analytics#usage",
  claudeUsageUrl: "https://claude.ai/settings/usage",
  checkIntervalMinutes: 10,
  idleMinutesBeforeSummary: 20,
  weeklyFullReminderHours: 4,
  quietHoursEnabled: true,
  quietHoursStart: 23,
  quietHoursEnd: 8,
  headless: true,
  logLevel: "info",
  stateFilePath: "data/state.json",
  browserConnectionMode: "cdp",
  chromeCdpUrl: "http://127.0.0.1:9222",
  chromeUserDataDir: "$HOME/.mongi-chrome-profile"
};

function readString(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function readNumber(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function readBrowserConnectionMode(value) {
  const mode = readString(value, DEFAULTS.browserConnectionMode).toLowerCase();

  if (!["cdp", "persistent"].includes(mode)) {
    throw new Error("BROWSER_CONNECTION_MODE must be either cdp or persistent.");
  }

  return mode;
}

function loadConfig() {
  return {
    discordWebhookUrl: readString(process.env.DISCORD_WEBHOOK_URL),
    codexUsageUrl: readString(process.env.CODEX_USAGE_URL, DEFAULTS.codexUsageUrl),
    claudeUsageUrl: readString(process.env.CLAUDE_USAGE_URL, DEFAULTS.claudeUsageUrl),
    checkIntervalMinutes: readNumber(process.env.CHECK_INTERVAL_MINUTES, DEFAULTS.checkIntervalMinutes),
    idleMinutesBeforeSummary: readNumber(process.env.IDLE_MINUTES_BEFORE_SUMMARY, DEFAULTS.idleMinutesBeforeSummary),
    weeklyFullReminderHours: readNumber(process.env.WEEKLY_FULL_REMINDER_HOURS, DEFAULTS.weeklyFullReminderHours),
    quietHours: {
      enabled: readBoolean(process.env.QUIET_HOURS_ENABLED, DEFAULTS.quietHoursEnabled),
      startHour: readNumber(process.env.QUIET_HOURS_START, DEFAULTS.quietHoursStart),
      endHour: readNumber(process.env.QUIET_HOURS_END, DEFAULTS.quietHoursEnd)
    },
    headless: readBoolean(process.env.HEADLESS, DEFAULTS.headless),
    logLevel: readString(process.env.LOG_LEVEL, DEFAULTS.logLevel),
    stateFilePath: readString(process.env.STATE_FILE_PATH, DEFAULTS.stateFilePath),
    browserConnectionMode: readBrowserConnectionMode(process.env.BROWSER_CONNECTION_MODE),
    chromeCdpUrl: readString(process.env.CHROME_CDP_URL, DEFAULTS.chromeCdpUrl),
    chromeUserDataDir: readString(process.env.CHROME_USER_DATA_DIR, DEFAULTS.chromeUserDataDir),
    dryRunNotifications: readBoolean(process.env.DRY_RUN_NOTIFICATIONS, false)
  };
}

function requireDiscordConfig(config) {
  if (!config || !config.discordWebhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL is missing.");
  }

  return config;
}

module.exports = {
  loadConfig,
  requireDiscordConfig
};
