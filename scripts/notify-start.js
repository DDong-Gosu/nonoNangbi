const { loadConfig, requireDiscordConfig } = require("../src/config");
const { isQuietHours } = require("../src/events/eventDetector");
const { getStartMessage } = require("../src/notifications/messages");
const { sendDiscordMessage } = require("../src/notifications/discord");
const { getGitOutputStatus } = require("../src/output/gitOutputStatus");
const logger = require("../src/utils/logger");

async function main() {
  const config = loadConfig();
  const bestEffort = process.argv.includes("--best-effort");
  const now = new Date();
  const quiet = isQuietHours(config, now);

  if (!config.discordWebhookUrl) {
    if (bestEffort) {
      logger.info("Mongi start Discord notification skipped because webhook is not configured.");
      return;
    }

    requireDiscordConfig(config);
  }

  const output = getGitOutputStatus({
    cwd: process.cwd(),
    now,
    quietHoursActive: quiet
  });

  if (quiet) {
    logger.info("Mongi start Discord notification suppressed by quiet hours.", {
      outputStatus: output.outputStatus
    });
    return;
  }

  const message = getStartMessage({
    output,
    checkIntervalMinutes: config.checkIntervalMinutes
  });

  try {
    await sendDiscordMessage(config, message);
    logger.info("Mongi start Discord notification sent.", {
      outputStatus: output.outputStatus
    });
  } catch (error) {
    if (!bestEffort) {
      throw error;
    }

    logger.warn("Mongi start Discord notification failed in best-effort mode.", {
      errorReason: error.message
    });
  }
}

main().catch((error) => {
  logger.error(`Mongi start notification failed: ${error.message}`, error);
  process.exitCode = 1;
});
