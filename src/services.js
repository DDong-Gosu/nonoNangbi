const { parseCodexUsage } = require("./parsers/codexParser");
const { parseClaudeUsage } = require("./parsers/claudeParser");
const { createCdpBackend } = require("./backends/cdpBackend");

function createServices(config) {
  return [
    {
      key: "codex",
      name: "Codex",
      usageUrl: config.codexUsageUrl,
      parser: parseCodexUsage,
      createBackend: createCdpBackend
    },
    {
      key: "claude",
      name: "Claude",
      usageUrl: config.claudeUsageUrl,
      parser: parseClaudeUsage,
      createBackend: createCdpBackend
    }
  ];
}

function selectServices(config, keys = []) {
  const services = createServices(config);
  const selectedKeys = keys.map((key) => String(key).toLowerCase()).filter(Boolean);

  if (selectedKeys.length === 0) {
    return services;
  }

  const selectedServices = services.filter((service) => selectedKeys.includes(service.key));

  if (selectedServices.length === 0) {
    throw new Error(`Unknown service: ${selectedKeys.join(", ")}`);
  }

  return selectedServices;
}

module.exports = {
  createServices,
  selectServices
};
