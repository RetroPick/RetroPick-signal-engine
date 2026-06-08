export const newsCategories = [
  {
    id: "crypto",
    label: "Crypto",
    keywords: [
      "bitcoin",
      "btc",
      "ethereum",
      "eth",
      "crypto",
      "defi",
      "stablecoin",
      "etf",
      "blockchain",
      "token",
      "solana",
      "base",
      "liquidation",
      "staking",
      "exchange",
    ],
    whyItMatters:
      "Relevant for crypto event-risk markets around price direction, volatility, ETF flows, protocol activity, liquidity, and on-chain health.",
  },
  {
    id: "economics",
    label: "Economics",
    keywords: [
      "cpi",
      "inflation",
      "fed",
      "federal reserve",
      "interest rate",
      "rate cut",
      "rate hike",
      "unemployment",
      "jobs",
      "payroll",
      "gdp",
      "recession",
      "central bank",
      "treasury",
      "dollar",
    ],
    whyItMatters:
      "Relevant for macro event markets around CPI, Fed decisions, unemployment, GDP, recession risk, and portfolio-sensitive economic releases.",
  },
  {
    id: "financials",
    label: "Financials",
    keywords: [
      "stock",
      "stocks",
      "equity",
      "earnings",
      "revenue",
      "guidance",
      "ipo",
      "merger",
      "acquisition",
      "valuation",
      "nasdaq",
      "s&p",
      "dow",
      "bond",
      "yield",
      "bank",
      "fund",
    ],
    whyItMatters:
      "Relevant for company, earnings, valuation, bond yield, and market-structure events that can become financial event-risk markets.",
  },
  {
    id: "tech_science",
    label: "Tech & Science",
    keywords: [
      "ai",
      "artificial intelligence",
      "openai",
      "anthropic",
      "google",
      "deepmind",
      "model",
      "benchmark",
      "chip",
      "semiconductor",
      "nvidia",
      "launch",
      "space",
      "nasa",
      "research",
      "study",
      "trial",
      "science",
    ],
    whyItMatters:
      "Relevant for technology, AI, launch, benchmark, research, and science milestone markets where forecasts become product or research intelligence.",
  },
  {
    id: "climate",
    label: "Climate",
    keywords: [
      "climate",
      "weather",
      "temperature",
      "heat",
      "rain",
      "rainfall",
      "flood",
      "storm",
      "hurricane",
      "drought",
      "wildfire",
      "emissions",
      "earth",
      "ocean",
      "natural event",
      "energy demand",
    ],
    whyItMatters:
      "Relevant for weather and climate-risk markets around temperature, rainfall, floods, storms, droughts, energy demand, logistics, and operational hedging.",
  },
];

export function getNewsCategory(categoryId) {
  return newsCategories.find((category) => category.id === categoryId);
}

export function classifyNewsItem(news) {
  const text = `${news.title || ""} ${news.summary || ""} ${news.category || ""} ${news.source || ""}`.toLowerCase();
  const scored = newsCategories.map((category) => {
    const score = category.keywords.reduce((total, keyword) => {
      return text.includes(keyword.toLowerCase()) ? total + 1 : total;
    }, 0);
    return { category, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  if (!winner || winner.score === 0) {
    return {
      id: "general",
      label: "General Market Risk",
      relevanceScore: 0,
      whyItMatters:
        "Potentially relevant as a market-risk signal, but it needs manual review before being mapped to a RetroPick market.",
    };
  }

  return {
    ...winner.category,
    relevanceScore: winner.score,
  };
}
