import { XMLParser } from "fast-xml-parser";
import { classifyNewsItem, newsCategories } from "../config/newsCategories.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getRssItems(parsed) {
  if (parsed?.rss?.channel?.item) return toArray(parsed.rss.channel.item);
  if (parsed?.feed?.entry) return toArray(parsed.feed.entry);
  return [];
}

function getLink(item) {
  if (typeof item.link === "string") return item.link;
  if (Array.isArray(item.link)) {
    return item.link.find((link) => link.href)?.href || item.link[0]?.href || "";
  }
  return item.link?.href || item.guid?.["#text"] || item.guid || "";
}

function getCategory(item) {
  const category = toArray(item.category)[0];
  if (!category) return "Crypto & Macro";
  if (typeof category === "string") return category;
  return category["#text"] || category.term || category.label || category.domain || "Crypto & Macro";
}

function normalizeSourceName(sourceUrl) {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
    return host.split(".").slice(0, -1).join(".") || host;
  } catch {
    return "External News";
  }
}

export function parseList(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function envKeyForCategory(category) {
  return `NEWS_SOURCES_${String(category || "").toUpperCase()}`;
}

function getSourcesForCategory(category) {
  if (category && category !== "all") {
    const categorySources = parseList(process.env[envKeyForCategory(category)], []);
    if (categorySources.length) return categorySources;
  }

  return parseList(
    process.env.NEWS_SOURCES,
    [
      "https://www.coindesk.com/arc/outboundfeeds/rss/",
      "https://techcrunch.com/feed/",
      "https://www.nasa.gov/technology/feed/",
      "https://science.nasa.gov/feed/earth-observatory/natural-events",
    ],
  );
}

export function newsMatchesKeywords(news, keywords) {
  if (!keywords.length) return true;
  const haystack = `${news.title} ${news.summary} ${news.category}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function newsMatchesCategory(news, categoryId) {
  if (!categoryId || categoryId === "all") return true;
  return news.marketCategory === categoryId;
}

export async function fetchNewsFromRss(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "RetroPickSignalEngine/1.0",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS ${sourceUrl}: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const source = parsed?.rss?.channel?.title || parsed?.feed?.title || normalizeSourceName(sourceUrl);

  return getRssItems(parsed).map((item) => {
    const news = {
      id: String(item.guid?.["#text"] || item.guid || item.id || getLink(item) || item.title),
      title: stripHtml(item.title),
      summary: stripHtml(item.description || item.summary || item.content || item["content:encoded"] || ""),
      url: getLink(item),
      source,
      category: stripHtml(getCategory(item)),
      publishedAt: item.pubDate || item.published || item.updated || null,
    };
    const marketCategory = classifyNewsItem(news);
    return {
      ...news,
      marketCategory: marketCategory.id,
      marketCategoryLabel: marketCategory.label,
      whyItMatters: marketCategory.whyItMatters,
      relevanceScore: marketCategory.relevanceScore || 0,
    };
  });
}

export async function fetchExternalNews({ limit = 5, category = "all" } = {}) {
  const sources = getSourcesForCategory(category);
  const keywords = parseList(
    process.env.NEWS_KEYWORDS,
    newsCategories.flatMap((item) => item.keywords),
  );

  const results = await Promise.allSettled(sources.map((source) => fetchNewsFromRss(source)));
  const news = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => item.title && item.url)
    .filter((item) => newsMatchesKeywords(item, keywords))
    .filter((item) => newsMatchesCategory(item, category))
    .filter((item) => item.relevanceScore >= Number(process.env.NEWS_MIN_RELEVANCE_SCORE || 1))
    .sort((a, b) => {
      const byDate = new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
      return byDate || b.relevanceScore - a.relevanceScore;
    });

  return news.slice(0, Number(limit) || 5);
}
