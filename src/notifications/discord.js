async function sendDiscordMessage(config, content) {
  if (!config || !config.discordWebhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL is missing.");
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Discord message content is empty.");
  }

  if (typeof fetch !== "function") {
    throw new Error("Native fetch is unavailable. Use Node.js 18 or newer.");
  }

  const response = await fetch(config.discordWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      content
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    const shortBody = responseText.slice(0, 300);
    throw new Error(`Discord webhook failed with status ${response.status}: ${shortBody}`);
  }

  return true;
}

module.exports = {
  sendDiscordMessage
};
