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

function percent(value) {
  return value ? `${Math.round(Number(value) * 100)}%` : null;
}

function number(value) {
  return value ? Number(value).toLocaleString("en-US") : null;
}

export function marketTemplate(market = {}) {
  const title = escapeHtml(market.title || "New market is live");
  const category = escapeHtml(market.category || "General");
  const marketType = escapeHtml(market.marketType || "Prediction");
  const yesPrice = percent(market.yesPrice);
  const volume24hr = number(market.volume24hr);

  return [
    "\uD83D\uDD25 <b>RetroPick Market Brief</b>",
    "",
    `<b>${title}</b>`,
    "",
    `Category: ${category}`,
    `Market Type: ${marketType}`,
    yesPrice ? `YES Implied Probability: ${yesPrice}` : null,
    volume24hr ? `24h Market Activity: ${volume24hr}` : null,
    "",
    "Why it matters:",
    `This is a live market signal for ${category} event risk and probability shifts.`,
    "",
    "RetroPick note:",
    "Watch how the implied probability moves before the next resolution window.",
    "",
    "Signal only, not financial advice.",
  ].filter(Boolean).join("\n");
}

export function marketDiscordTemplate(market = {}) {
  const title = escapeMarkdown(market.title || "New market is live");
  const category = escapeMarkdown(market.category || "General");
  const marketType = escapeMarkdown(market.marketType || "Prediction");
  const yesPrice = percent(market.yesPrice);
  const volume24hr = number(market.volume24hr);

  return [
    "🔥 **RetroPick Market Brief**",
    "",
    `**${title}**`,
    "",
    `Category: ${category}`,
    `Market Type: ${marketType}`,
    yesPrice ? `YES Implied Probability: ${yesPrice}` : null,
    volume24hr ? `24h Market Activity: ${volume24hr}` : null,
    "",
    "**Why it matters:**",
    `This is a live market signal for ${category} event risk and probability shifts.`,
    "",
    "**RetroPick note:**",
    "Watch how the implied probability moves before the next resolution window.",
    "",
    "_Signal only, not financial advice._",
  ].filter(Boolean).join("\n");
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
  const source = escapeHtml(news.source || "External News");
  const summary = escapeHtml(news.whyItMatters || news.summary || news.description || "New market-moving update.");
  const url = clean(news.url || news.link || "");
  const category = escapeHtml(news.marketCategoryLabel || news.category || "Market Risk");

  return [
    "\uD83D\uDCF0 <b>RetroPick Daily News</b>",
    "",
    `<b>${title}</b>`,
    "",
    `Category: ${category}`,
    `Source: ${source}`,
    "",
    "Why it matters:",
    summary,
    "",
    "RetroPick angle:",
    `Relevant for ${category} prediction-market sentiment and event-risk tracking.`,
    "",
    url ? "Read more:" : null,
    url || null,
  ].filter(Boolean).join("\n");
}

export function newsDiscordTemplate(news = {}) {
  const title = escapeMarkdown(news.title || "Market Alpha News");
  const source = escapeMarkdown(news.source || "External News");
  const summary = escapeMarkdown(news.whyItMatters || news.summary || news.description || "New market-moving update.");
  const url = clean(news.url || news.link || "");
  const category = escapeMarkdown(news.marketCategoryLabel || news.category || "Market Risk");

  return [
    "📰 **RetroPick Daily News**",
    "",
    `**${title}**`,
    "",
    `Category: ${category}`,
    `Source: ${source}`,
    "",
    "**Why it matters:**",
    summary,
    "",
    "**RetroPick angle:**",
    `Relevant for ${category} prediction-market sentiment and event-risk tracking.`,
    "",
    url ? "Read more:" : null,
    url || null,
  ].filter(Boolean).join("\n");
}
