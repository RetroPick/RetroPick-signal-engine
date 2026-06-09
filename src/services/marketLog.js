import { getDeliveries, hasDeliveryBeenSent, saveDelivery } from "./deliveryLog.js";

const logFile = "market-log.json";

export async function hasMarketBeenSent(marketId, platform) {
  return hasDeliveryBeenSent(logFile, marketId, platform);
}

export async function hasMarketTitleBeenSent(title, platform) {
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

export async function saveMarketDelivery({ market, platform, status, message, error }) {
  await saveDelivery(logFile, {
    key: market.marketId,
    market_id: market.marketId,
    title: market.title,
    category: market.category || null,
    platform,
    status,
    message,
    error_message: error || null,
  });
}
