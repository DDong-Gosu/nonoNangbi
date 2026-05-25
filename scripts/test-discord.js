const { loadConfig, requireDiscordConfig } = require("../src/config");
const logger = require("../src/utils/logger");
const { getTestMessage } = require("../src/notifications/messages");
const { sendDiscordMessage } = require("../src/notifications/discord");

async function main() {
  const config = loadConfig();
  requireDiscordConfig(config);

  const message = getTestMessage();
  await sendDiscordMessage(config, message);

  logger.info("Discord test message sent successfully.");
}

main().catch((error) => {
  logger.error(`Discord test failed: ${error.message}`, error);
  process.exitCode = 1;
});
