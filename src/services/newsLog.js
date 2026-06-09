import { getDeliveries, hasDeliveryBeenSent, saveDelivery } from "./deliveryLog.js";

const logFile = "news-log.json";

export async function hasNewsBeenSent(url, platform) {
  return hasDeliveryBeenSent(logFile, url, platform);
}

export async function hasNewsTitleBeenSent(title, platform) {
  if (!title) return false;
  const normalizedTitle = String(title).trim().toLowerCase();
  const entries = await getDeliveries(logFile, 1000);
  return entries.some((entry) => {
    return (
      String(entry.title || "").trim().toLowerCase() === normalizedTitle &&
      entry.platform === platform &&
      entry.status === "sent"
    );
  });
}

export async function saveNewsDelivery({ news, platform, status, message, error }) {
  await saveDelivery(logFile, {
    key: news.url,
    url: news.url,
    title: news.title,
    source: news.source,
    market_category: news.marketCategory || null,
    relevance_score: news.relevanceScore || 0,
    platform,
    status,
    message,
    error_message: error || null,
  });
}
