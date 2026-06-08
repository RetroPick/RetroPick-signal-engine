import { classifyNewsItem } from "../config/newsCategories.js";
import { parseList } from "./newsFetcher.js";

function clean(value, fallback = "") {
  return String(value || fallback).trim();
}

function parseJsonValue(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function buildPolymarketUrl(market) {
  if (market.slug) return `https://polymarket.com/market/${market.slug}`;
  return "https://polymarket.com/markets";
}

function normalizePolymarketMarket(market) {
  const title = clean(market.question || market.title || market.description, "Untitled market");
  const category = classifyNewsItem({
    title,
    summary: `${market.description || ""} ${market.tags || ""}`,
    category: market.category || "",
    source: "Polymarket",
  });
  const outcomes = parseJsonValue(market.outcomes);
  const outcomePrices = parseJsonValue(market.outcomePrices);
  const yesIndex = outcomes.findIndex((outcome) => String(outcome).toLowerCase() === "yes");
  const yesPrice = yesIndex >= 0 ? toNumber(outcomePrices[yesIndex]) : toNumber(outcomePrices[0]);

  return {
    marketId: `polymarket-${market.id || market.conditionId || market.slug}`,
    externalId: market.id || market.conditionId || market.slug,
    title,
    category: category.label,
    marketCategory: category.id,
    marketCategoryLabel: category.label,
    relevanceScore: category.relevanceScore || 0,
    marketType: "External Prediction Market",
    source: "Polymarket",
    url: buildPolymarketUrl(market),
    endDate: market.endDate || market.endDateIso || null,
    volume: toNumber(market.volume || market.volumeNum),
    volume24hr: toNumber(market.volume24hr || market.volume24hrClob),
    liquidity: toNumber(market.liquidity || market.liquidityNum),
    yesPrice,
    active: Boolean(market.active),
    closed: Boolean(market.closed),
  };
}

async function fetchPolymarketMarkets({ limit = 20 } = {}) {
  const url = new URL("https://gamma-api.polymarket.com/markets");
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(Math.max(Number(limit) || 20, 10)));
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "RetroPickSignalEngine/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Polymarket markets: ${response.status}`);
  }

  const payload = await response.json();
  return (Array.isArray(payload) ? payload : payload.markets || []).map(normalizePolymarketMarket);
}

function marketMatchesCategory(market, category) {
  if (!category || category === "all") return true;
  return market.marketCategory === category;
}

export async function fetchExternalMarkets({ limit = 5, category = "all" } = {}) {
  const sources = parseList(process.env.MARKET_SOURCES, ["polymarket"]);
  const sourceLimit = Math.max(Number(limit) || 5, 20);
  const results = await Promise.allSettled(
    sources.map((source) => {
      if (source.toLowerCase() === "polymarket") {
        return fetchPolymarketMarkets({ limit: sourceLimit });
      }
      return Promise.resolve([]);
    }),
  );
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length === results.length) {
    throw new Error(
      `All external market sources failed: ${failures
        .map((failure) => failure.reason?.message || String(failure.reason))
        .join("; ")}`,
    );
  }

  return results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((market) => market.title && market.url)
    .filter((market) => marketMatchesCategory(market, category))
    .filter((market) => market.relevanceScore >= Number(process.env.MARKET_MIN_RELEVANCE_SCORE || 1))
    .sort((a, b) => b.volume24hr - a.volume24hr || b.volume - a.volume)
    .slice(0, Number(limit) || 5);
}
