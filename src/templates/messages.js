export function clean(value, fallback = "-") {
  return String(value || fallback).trim();
}

function escapeHtml(value) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeMarkdown(value) {
  return clean(value).replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}

function trimQuestion(value) {
  return clean(value)
    .replace(/^will\s+/i, "")
    .replace(/\?+$/g, "")
    .trim();
}

function marketTopic(market = {}) {
  return clean(
    market.topic ||
      market.marketTopic ||
      market.headlineTopic ||
      trimQuestion(market.title || "This market"),
    "This market",
  );
}

function marketContext(market = {}, category = "market") {
  return clean(
    market.context ||
      market.shortContext ||
      market.description ||
      `Traders are watching whether this ${category} setup can turn into a stronger market move.`,
  );
}

function newsQuestion(news = {}) {
  const text = `${news.title || ""} ${news.summary || ""} ${news.description || ""}`.toLowerCase();
  const category = clean(news.marketCategoryLabel || news.category || "market");

  if (text.includes("bitcoin") || text.includes("btc")) {
    return clean(news.marketQuestion || news.question || "Will Bitcoin hit a new all-time high before 2027?");
  }

  if (text.includes("ethereum") || text.includes("eth")) {
    return clean(news.marketQuestion || news.question || "Will ETH outperform BTC before the next major market rotation?");
  }

  if (text.includes("fed") || text.includes("inflation") || text.includes("cpi")) {
    return clean(news.marketQuestion || news.question || "Will the next major macro release shift crypto market sentiment?");
  }

  if (text.includes("ai") || text.includes("openai") || text.includes("anthropic")) {
    return clean(news.marketQuestion || news.question || "Will this AI development accelerate market adoption in 2026?");
  }

  return clean(
    news.marketQuestion ||
      news.question ||
      news.relatedMarket ||
      `Will this ${category} signal create a measurable move?`,
  );
}

export function marketTemplate(market = {}) {
  const topic = escapeHtml(marketTopic(market));
  const category = escapeHtml(market.category || market.marketCategoryLabel || "market");
  const context = escapeHtml(marketContext(market, category));
  const emoji = market.emoji || "\uD83D\uDD25";
  const headline = clean(market.headline || `${emoji} ${topic} is back in focus.`);

  return [
    escapeHtml(headline),
    "",
    context,
    "",
    "YES or NO?",
  ].join("\n");
}

export function marketDiscordTemplate(market = {}) {
  const topic = escapeMarkdown(marketTopic(market));
  const category = escapeMarkdown(market.category || market.marketCategoryLabel || "market");
  const context = escapeMarkdown(marketContext(market, category));
  const emoji = market.emoji || "🔥";
  const headline = escapeMarkdown(market.headline || `${emoji} ${topic} is back in focus.`);

  return [
    headline,
    "",
    context,
    "",
    "**YES or NO?**",
  ].join("\n");
}

export function announcementTemplate(announcement = {}) {
  const title = escapeHtml(announcement.title || "RetroPick Update");
  const body = escapeHtml(announcement.body || "New update from RetroPick.");
  const url = clean(announcement.url || "");

  return [
    "\u26A1 <b>RetroPick Update</b>",
    "",
    `<b>${title}</b>`,
    "",
    body,
    "",
    url ? "Read more:" : null,
    url || null,
  ].filter(Boolean).join("\n");
}

export function announcementDiscordTemplate(announcement = {}) {
  const title = escapeMarkdown(announcement.title || "RetroPick Update");
  const body = escapeMarkdown(announcement.body || "New update from RetroPick.");
  const url = clean(announcement.url || "");

  return [
    "⚡ **RetroPick Update**",
    "",
    `**${title}**`,
    "",
    body,
    "",
    url ? "Read more:" : null,
    url || null,
  ].filter(Boolean).join("\n");
}

export function newsTemplate(news = {}) {
  const title = escapeHtml(news.title || "Market Alpha News");
  const summary = escapeHtml(news.context || news.summary || news.description || news.whyItMatters || "A new market-moving update is developing.");
  const question = escapeHtml(newsQuestion(news));
  const url = clean(news.url || news.link || "");

  return [
    "\u26A1 <b>RetroPick News Signal</b>",
    "",
    `<b>${title}</b>`,
    "",
    summary,
    "",
    question,
    "",
    url || null,
  ].filter(Boolean).join("\n");
}

export function newsDiscordTemplate(news = {}) {
  const title = escapeMarkdown(news.title || "Market Alpha News");
  const summary = escapeMarkdown(news.context || news.summary || news.description || news.whyItMatters || "A new market-moving update is developing.");
  const question = escapeMarkdown(newsQuestion(news));
  const url = clean(news.url || news.link || "");

  return [
    "⚡ **RetroPick News Signal**",
    "",
    `**${title}**`,
    "",
    summary,
    "",
    question,
    "",
    url || null,
  ].filter(Boolean).join("\n");
}
