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

export function marketTemplate(market = {}) {
  const title = escapeHtml(market.title || "New market is live");
  const category = escapeHtml(market.category || "General");
  const marketType = escapeHtml(market.marketType || "Prediction");
  const url = clean(market.url || "https://retropick-v1.vercel.app");
  const source = escapeHtml(market.source || "External Market");
  const yesPrice = market.yesPrice ? `${Math.round(Number(market.yesPrice) * 100)}%` : null;

  return [
    "\uD83D\uDD25 <b>Market Signal</b>",
    "",
    `<b>${title}</b>`,
    "",
    `Source: ${source}`,
    `Category: ${category}`,
    `Type: ${marketType}`,
    yesPrice ? `YES implied price: ${yesPrice}` : null,
    market.volume24hr ? `24h Volume: ${Number(market.volume24hr).toLocaleString("en-US")}` : null,
    "",
    "View market:",
    url,
  ].filter(Boolean).join("\n");
}

export function marketDiscordTemplate(market = {}) {
  const title = escapeMarkdown(market.title || "New market is live");
  const category = escapeMarkdown(market.category || "General");
  const marketType = escapeMarkdown(market.marketType || "Prediction");
  const url = clean(market.url || "https://retropick-v1.vercel.app");
  const source = escapeMarkdown(market.source || "External Market");
  const yesPrice = market.yesPrice ? `${Math.round(Number(market.yesPrice) * 100)}%` : null;

  return [
    "🔥 **Market Signal**",
    "",
    `**${title}**`,
    "",
    `Source: ${source}`,
    `Category: ${category}`,
    `Type: ${marketType}`,
    yesPrice ? `YES implied price: ${yesPrice}` : null,
    market.volume24hr ? `24h Volume: ${Number(market.volume24hr).toLocaleString("en-US")}` : null,
    "",
    "View market:",
    url,
  ].filter(Boolean).join("\n");
}

export function announcementTemplate(announcement = {}) {
  const title = escapeHtml(announcement.title || "RetroPick Update");
  const body = escapeHtml(announcement.body || "New update from RetroPick.");
  const url = clean(announcement.url || "https://retropick-v1.vercel.app");

  return [
    "\u26A1 <b>RetroPick Update</b>",
    "",
    `<b>${title}</b>`,
    "",
    body,
    "",
    "Open RetroPick:",
    url,
  ].join("\n");
}

export function announcementDiscordTemplate(announcement = {}) {
  const title = escapeMarkdown(announcement.title || "RetroPick Update");
  const body = escapeMarkdown(announcement.body || "New update from RetroPick.");
  const url = clean(announcement.url || "https://retropick-v1.vercel.app");

  return [
    "⚡ **RetroPick Update**",
    "",
    `**${title}**`,
    "",
    body,
    "",
    "Open RetroPick:",
    url,
  ].join("\n");
}

export function newsTemplate(news = {}) {
  const title = escapeHtml(news.title || "Market Alpha News");
  const source = escapeHtml(news.source || "External News");
  const summary = escapeHtml(news.whyItMatters || news.summary || news.description || "New market-moving update.");
  const url = clean(news.url || news.link || "https://retropick-v1.vercel.app");
  const category = escapeHtml(news.marketCategoryLabel || news.category || "Market Risk");
  const score = Number(news.relevanceScore || 0);

  return [
    "\uD83D\uDCF0 <b>RetroPick Market Alpha</b>",
    "",
    `<b>${title}</b>`,
    "",
    `Source: ${source}`,
    `RetroPick Category: ${category}`,
    `Relevance Score: ${score}`,
    "",
    "Prediction-market angle:",
    summary,
    "",
    "Possible market idea:",
    `Will this ${category} event create a measurable outcome before the next resolution window?`,
    "",
    "Note: signal only, not financial advice.",
    "",
    "Read more:",
    url,
  ].join("\n");
}

export function newsDiscordTemplate(news = {}) {
  const title = escapeMarkdown(news.title || "Market Alpha News");
  const source = escapeMarkdown(news.source || "External News");
  const summary = escapeMarkdown(news.whyItMatters || news.summary || news.description || "New market-moving update.");
  const url = clean(news.url || news.link || "https://retropick-v1.vercel.app");
  const category = escapeMarkdown(news.marketCategoryLabel || news.category || "Market Risk");
  const score = Number(news.relevanceScore || 0);

  return [
    "📰 **RetroPick Market Alpha**",
    "",
    `**${title}**`,
    "",
    `Source: ${source}`,
    `RetroPick Category: ${category}`,
    `Relevance Score: ${score}`,
    "",
    "**Prediction-market angle:**",
    summary,
    "",
    "**Possible market idea:**",
    `Will this ${category} event create a measurable outcome before the next resolution window?`,
    "",
    "_Signal only, not financial advice._",
    "",
    "Read more:",
    url,
  ].join("\n");
}
