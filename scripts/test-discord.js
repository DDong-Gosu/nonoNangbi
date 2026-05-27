const { loadConfig, requireDiscordConfig } = require("../src/config");
const logger = require("../src/utils/logger");
const { getTestMessage } = require("../src/notifications/messages");
const { getGitOutputStatus } = require("../src/output/gitOutputStatus");
const { sendDiscordMessage } = require("../src/notifications/discord");

async function main() {
  const config = loadConfig();
  requireDiscordConfig(config);

  const output = getGitOutputStatus({ cwd: process.cwd(), now: new Date() });
  const message = getTestMessage({
    output,
    checkIntervalMinutes: config.checkIntervalMinutes
  });

  await sendDiscordMessage(config, message);

  logger.info("Discord test message sent successfully.");
}

main().catch((error) => {
  logger.error(`Discord test failed: ${error.message}`, error);
  process.exitCode = 1;
});
