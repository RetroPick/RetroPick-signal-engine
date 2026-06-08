import { hasDeliveryBeenSent, saveDelivery } from "./deliveryLog.js";

const logFile = "market-log.json";

export async function hasMarketBeenSent(marketId, platform) {
  return hasDeliveryBeenSent(logFile, marketId, platform);
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
