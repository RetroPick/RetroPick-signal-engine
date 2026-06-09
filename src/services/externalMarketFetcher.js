import { classifyNewsItem } from "../config/newsCategories.js";
import { fetchExternalNews, parseList } from "./newsFetcher.js";

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
    context: clean(
      market.description ||
        `Traders are watching whether this ${category.label} market can confirm a stronger probability shift.`,
    ),
    category: category.label,
    marketCategory: category.id,
    marketCategoryLabel: category.label,
    relevanceScore: category.relevanceScore || 0,
    marketType: "External Prediction Market",
    source: "Polymarket",
    url: buildPolymarketUrl(market),
    createdAt: market.createdAt || market.created_at || market.startDate || null,
    updatedAt: market.updatedAt || market.updated_at || null,
    endDate: market.endDate || market.endDateIso || null,
    volume: toNumber(market.volume || market.volumeNum),
    volume24hr: toNumber(market.volume24hr || market.volume24hrClob),
    liquidity: toNumber(market.liquidity || market.liquidityNum),
    yesPrice,
    active: Boolean(market.active),
    closed: Boolean(market.closed),
  };
}

function topicFromNews(news) {
  const text = `${news.title || ""} ${news.summary || ""}`.toLowerCase();

  if (text.includes("ethereum") || text.includes("eth")) {
    return {
      headline: "\u{1F4C8} ETH momentum is heating up.",
      title: "Will ETH outperform BTC as rotation returns?",
      context:
        "Traders are watching whether ETH can outperform BTC as rotation returns across major crypto assets.",
      closing: "Key question: Can ETH outperform BTC as rotation builds?",
    };
  }

  if (text.includes("bitcoin") || text.includes("btc")) {
    return {
      headline: "\u{1F525} Bitcoin momentum is back in focus.",
      title: "Will Bitcoin continue leading crypto market sentiment?",
      context:
        "Traders are watching whether BTC strength can turn into a broader market recovery.",
      closing: "Key question: Can BTC strength pull the broader market higher?",
    };
  }

  if (text.includes("ai") || text.includes("openai") || text.includes("anthropic")) {
    return {
      headline: "\u{1F525} AI market momentum is back in focus.",
      title: "Will AI-related assets and narratives keep gaining attention?",
      context:
        "Traders are watching whether fresh AI developments can drive another wave of market interest.",
      closing: "Potential impact: AI momentum could spill into tech and crypto narratives.",
    };
  }

  if (text.includes("fed") || text.includes("inflation") || text.includes("cpi")) {
    return {
      headline: "\u{1F525} Macro risk is back in focus.",
      title: "Will the next macro signal shift market sentiment?",
      context:
        "Traders are watching whether macro data can trigger a stronger risk-on or risk-off move.",
      closing: "Potential impact: A surprise macro print could shift risk sentiment fast.",
    };
  }

  return {
      headline: `\u{1F525} ${news.marketCategoryLabel || "Market"} momentum is back in focus.`,
      title: news.title || "Will this market theme continue gaining attention?",
      context:
        news.summary ||
        news.whyItMatters ||
        "Traders are watching whether this setup can turn into a stronger market move.",
      closing: `Market question: Will this ${news.marketCategoryLabel || "market"} theme keep gaining attention?`,
    };
}

async function fetchMarketBriefsFromNews({ limit = 5, category = "all" } = {}) {
  const newsItems = await fetchExternalNews({
    limit: Math.max(Number(limit) || 5, 10),
    category,
  });

  return newsItems.slice(0, Number(limit) || 5).map((news) => {
    const brief = topicFromNews(news);
    return {
      marketId: `market-news-${news.id || Buffer.from(news.url).toString("base64url").slice(0, 32)}`,
      externalId: news.id || news.url,
      title: brief.title,
      headline: brief.headline,
      context: brief.context,
      closing: brief.closing,
      category: news.marketCategoryLabel || news.category || "Market",
      marketCategory: news.marketCategory || "general",
      marketCategoryLabel: news.marketCategoryLabel || news.category || "Market",
      relevanceScore: news.relevanceScore || 0,
      marketType: "Market News Brief",
      source: news.source || "External News",
      url: news.url,
      createdAt: news.publishedAt || new Date().toISOString(),
      volume: 0,
      volume24hr: 0,
      liquidity: 0,
      yesPrice: null,
      active: true,
      closed: false,
    };
  });
}

async function fetchPolymarketMarkets({ limit = 20 } = {}) {
  const url = new URL("https://gamma-api.polymarket.com/markets");
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(Math.max(Number(limit) || 20, 10)));
  url.searchParams.set("order", process.env.MARKET_ORDER || "createdAt");
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
    if (process.env.MARKET_FALLBACK_TO_NEWS !== "false") {
      return fetchMarketBriefsFromNews({ limit, category });
    }

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
    .sort((a, b) => {
      const byCreated = new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      return byCreated || b.volume24hr - a.volume24hr || b.volume - a.volume;
    })
    .slice(0, Number(limit) || 5);
}
