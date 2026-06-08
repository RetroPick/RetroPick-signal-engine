async function sendDiscordMessage(content, webhookUrl, label) {
  if (!webhookUrl) {
    throw new Error(`${label} Discord webhook is not configured`);
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`${label} Discord webhook failed: ${message}`);
  }

  return true;
}

export async function sendDiscordMarketMessage(content) {
  return sendDiscordMessage(
    content,
    process.env.DISCORD_MARKET_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL,
    "Market",
  );
}

export async function sendDiscordNewsMessage(content) {
  return sendDiscordMessage(
    content,
    process.env.DISCORD_NEWS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL,
    "News",
  );
}
