const { loadConfig } = require("../src/config");
const logger = require("../src/utils/logger");
const { nowIso } = require("../src/utils/time");
const { loadState, saveState } = require("../src/state/stateStore");

function main() {
  const config = loadConfig();
  const state = loadState(config);
  const timestamp = nowIso();

  state.meta = state.meta || {};
  state.meta.lastStateSmokeTestAt = timestamp;

  saveState(config, state);

  const reloadedState = loadState(config);

  if (!reloadedState.meta || reloadedState.meta.lastStateSmokeTestAt !== timestamp) {
    throw new Error("State smoke test timestamp did not persist.");
  }

  logger.info("State smoke test passed.", {
    stateFilePath: config.stateFilePath,
    lastStateSmokeTestAt: timestamp
  });
}

try {
  main();
} catch (error) {
  logger.error(`State smoke test failed: ${error.message}`, error);
  process.exitCode = 1;
}
