import "dotenv/config";
import path from "node:path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { sendDiscordMarketMessage, sendDiscordNewsMessage } from "./services/discord.js";
import { sendTelegramMarketMessage, sendTelegramNewsMessage } from "./services/telegram.js";
import { fetchExternalNews } from "./services/newsFetcher.js";
import { fetchExternalMarkets } from "./services/externalMarketFetcher.js";
import { hasNewsBeenSent, hasNewsTitleBeenSent } from "./services/newsLog.js";
import { claimDelivery, finishDelivery, getDailySentCount, getDeliveries } from "./services/deliveryLog.js";
import { hasMarketBeenSent, hasMarketTitleBeenSent } from "./services/marketLog.js";
import { classifyNewsItem, newsCategories } from "./config/newsCategories.js";
import { startMarketScheduler } from "./jobs/marketScheduler.js";
import { startNewsScheduler } from "./jobs/newsScheduler.js";
import { isSupabaseConfigured } from "./services/supabaseClient.js";
import {
  announcementDiscordTemplate,
  announcementTemplate,
  marketDiscordTemplate,
  marketTemplate,
  newsDiscordTemplate,
  newsTemplate,
} from "./templates/messages.js";

const app = express();
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json({ limit: "256kb" }));
app.use(morgan("dev"));
app.use(express.static("public"));
app.use("/assets", express.static("assets"));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 60),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(apiLimiter);

const requiredEnv = [
  "BROADCAST_SECRET",
  "TELEGRAM_MARKET_BOT_TOKEN",
  "TELEGRAM_MARKET_CHAT_ID",
  "TELEGRAM_MARKET_THREAD_ID",
  "TELEGRAM_NEWS_BOT_TOKEN",
  "TELEGRAM_NEWS_CHAT_ID",
  "TELEGRAM_NEWS_THREAD_ID",
  "DISCORD_MARKET_WEBHOOK_URL",
  "DISCORD_NEWS_WEBHOOK_URL",
];

function assertConfig() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

function requireSecret(req, res, next) {
  const secret = req.header("X-Retropick-Secret");
  if (!process.env.BROADCAST_SECRET || secret !== process.env.BROADCAST_SECRET) {
    return res.status(401).json({ error: "Invalid broadcast secret" });
  }
  next();
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function dispatchMessage(message, platforms = ["telegram", "discord"], channel = "market") {
  const selected = new Set(platforms);
  const jobs = [];
  const sendTelegram =
    channel === "news" ? sendTelegramNewsMessage : sendTelegramMarketMessage;
  const sendDiscord =
    channel === "news" ? sendDiscordNewsMessage : sendDiscordMarketMessage;

  if (selected.has("telegram")) {
    jobs.push(
      sendTelegram(message).then(
        (data) => ({ platform: "telegram", status: "sent", data }),
        (error) => ({ platform: "telegram", status: "failed", error: error.message }),
      ),
    );
  }

  if (selected.has("discord")) {
    jobs.push(
      sendDiscord(message).then(
        () => ({ platform: "discord", status: "sent" }),
        (error) => ({ platform: "discord", status: "failed", error: error.message }),
      ),
    );
  }

  return Promise.all(jobs);
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

async function dispatchMarket(market, platforms = ["telegram", "discord"], { skipDuplicates = true } = {}) {
  const selected = new Set(platforms);
  const telegramMessage = marketTemplate(market);
  const discordMessage = marketDiscordTemplate(market);
  const results = [];

  for (const platform of selected) {
    if (!["telegram", "discord"].includes(platform)) continue;

    if (
      skipDuplicates &&
      ((await hasMarketBeenSent(market.marketId, platform)) ||
        (await hasMarketTitleBeenSent(market.title, platform)))
    ) {
      results.push({ platform, status: "skipped", reason: "duplicate" });
      continue;
    }

    const message = platform === "telegram" ? telegramMessage : discordMessage;
    const claimed = await claimDelivery("market-log.json", {
      key: market.marketId,
      market_id: market.marketId,
      title: market.title,
      category: market.category || null,
      platform,
      message,
    });

    if (!claimed) {
      results.push({ platform, status: "skipped", reason: "duplicate" });
      continue;
    }

    try {
      if (platform === "telegram") {
        await sendTelegramMarketMessage(telegramMessage);
      } else {
        await sendDiscordMarketMessage(discordMessage);
      }
      await finishDelivery("market-log.json", market.marketId, platform, {
        status: "sent",
        message,
        payload: {
          key: market.marketId,
          market_id: market.marketId,
          title: market.title,
          category: market.category || null,
          platform,
          status: "sent",
          message,
        },
      });
      results.push({ platform, status: "sent" });
    } catch (error) {
      await finishDelivery("market-log.json", market.marketId, platform, {
        status: "failed",
        message,
        error_message: error.message,
        payload: {
          key: market.marketId,
          market_id: market.marketId,
          title: market.title,
          category: market.category || null,
          platform,
          status: "failed",
          message,
          error_message: error.message,
        },
      });
      results.push({ platform, status: "failed", error: error.message });
    }
  }

  return results;
}

async function dispatchNews(news, platforms = ["telegram", "discord"], { skipDuplicates = true } = {}) {
  const selected = new Set(platforms);
  const telegramMessage = newsTemplate(news);
  const discordMessage = newsDiscordTemplate(news);
  const results = [];

  for (const platform of selected) {
    if (!["telegram", "discord"].includes(platform)) continue;

    if (
      skipDuplicates &&
      ((await hasNewsBeenSent(news.url, platform)) ||
        (await hasNewsTitleBeenSent(news.title, platform)))
    ) {
      results.push({ platform, status: "skipped", reason: "duplicate" });
      continue;
    }

    const message = platform === "telegram" ? telegramMessage : discordMessage;
    const claimed = await claimDelivery("news-log.json", {
      key: news.url,
      url: news.url,
      title: news.title,
      source: news.source,
      market_category: news.marketCategory || null,
      relevance_score: news.relevanceScore || 0,
      platform,
      message,
    });

    if (!claimed) {
      results.push({ platform, status: "skipped", reason: "duplicate" });
      continue;
    }

    try {
      if (platform === "telegram") {
        await sendTelegramNewsMessage(telegramMessage);
      } else {
        await sendDiscordNewsMessage(discordMessage);
      }
      await finishDelivery("news-log.json", news.url, platform, {
        status: "sent",
        message,
        payload: {
          key: news.url,
          url: news.url,
          title: news.title,
          source: news.source,
          market_category: news.marketCategory || null,
          relevance_score: news.relevanceScore || 0,
          platform,
          status: "sent",
          message,
        },
      });
      results.push({ platform, status: "sent" });
    } catch (error) {
      await finishDelivery("news-log.json", news.url, platform, {
        status: "failed",
        message,
        error_message: error.message,
        payload: {
          key: news.url,
          url: news.url,
          title: news.title,
          source: news.source,
          market_category: news.marketCategory || null,
          relevance_score: news.relevanceScore || 0,
          platform,
          status: "failed",
          message,
          error_message: error.message,
        },
      });
      results.push({ platform, status: "failed", error: error.message });
    }
  }

  return results;
}

async function runNewsJob({ limit = 3, category = "all", platforms = ["telegram", "discord"] } = {}) {
  const newsItems = await fetchExternalNews({ limit, category });
  const deliveries = [];
  const dailyLimit = Number(process.env.DAILY_NEWS_LIMIT || 48);
  const capOffsetHours = Number(process.env.DAILY_CAP_TIMEZONE_OFFSET_HOURS || 7);

  for (const news of newsItems) {
    const dailyCount = await getDailySentCount("news-log.json", {
      platform: "telegram",
      offsetHours: capOffsetHours,
    });

    if (dailyCount >= dailyLimit) {
      deliveries.push({
        title: news.title,
        url: news.url,
        marketCategory: news.marketCategory,
        relevanceScore: news.relevanceScore,
        results: platforms.map((platform) => ({ platform, status: "skipped", reason: "daily-cap" })),
      });
      continue;
    }

    const results = await dispatchNews(news, platforms, { skipDuplicates: true });
    deliveries.push({
      title: news.title,
      url: news.url,
      marketCategory: news.marketCategory,
      relevanceScore: news.relevanceScore,
      results,
    });
  }

  return { fetched: newsItems.length, deliveries };
}

async function runMarketJob({ limit = 3, category = "all", platforms = ["telegram", "discord"] } = {}) {
  const marketItems = await fetchExternalMarkets({ limit, category });
  const deliveries = [];
  const dailyLimit = Number(process.env.DAILY_MARKET_LIMIT || 24);
  const capOffsetHours = Number(process.env.DAILY_CAP_TIMEZONE_OFFSET_HOURS || 7);

  for (const market of marketItems) {
    const dailyCount = await getDailySentCount("market-log.json", {
      platform: "telegram",
      offsetHours: capOffsetHours,
    });

    if (dailyCount >= dailyLimit) {
      deliveries.push({
        marketId: market.marketId,
        title: market.title,
        url: market.url,
        marketCategory: market.marketCategory,
        relevanceScore: market.relevanceScore,
        results: platforms.map((platform) => ({ platform, status: "skipped", reason: "daily-cap" })),
      });
      continue;
    }

    const results = await dispatchMarket(market, platforms, { skipDuplicates: true });
    deliveries.push({
      marketId: market.marketId,
      title: market.title,
      url: market.url,
      marketCategory: market.marketCategory,
      relevanceScore: market.relevanceScore,
      results,
    });
  }

  return { fetched: marketItems.length, deliveries };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "RetroPick Signal Engine",
    marketTelegramChat: process.env.TELEGRAM_MARKET_CHAT_ID || process.env.TELEGRAM_CHAT_ID || null,
    newsTelegramChat: process.env.TELEGRAM_NEWS_CHAT_ID || null,
    marketDiscordConfigured: Boolean(process.env.DISCORD_MARKET_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL),
    newsDiscordConfigured: Boolean(process.env.DISCORD_NEWS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL),
    storage: isSupabaseConfigured ? "supabase" : "local-json",
  });
});

app.get("/", (_req, res) => {
  res.sendFile(path.resolve("index.html"));
});

app.get("/styles.css", (_req, res) => {
  res.sendFile(path.resolve("styles.css"));
});

app.get("/script.js", (_req, res) => {
  res.sendFile(path.resolve("script.js"));
});

app.get("/news/fetch", requireSecret, asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 5);
  const category = String(req.query.category || "all");
  const news = await fetchExternalNews({ limit, category });
  res.json({ ok: true, count: news.length, news });
}));

app.get("/market/fetch", requireSecret, asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit || 5);
  const category = String(req.query.category || "all");
  const markets = await fetchExternalMarkets({ limit, category });
  res.json({ ok: true, count: markets.length, markets });
}));

app.get("/news/categories", requireSecret, (_req, res) => {
  res.json({
    ok: true,
    categories: newsCategories.map(({ id, label, keywords, whyItMatters }) => ({
      id,
      label,
      keywords,
      whyItMatters,
    })),
  });
});

app.get("/logs/news", requireSecret, asyncHandler(async (req, res) => {
  res.json({ ok: true, logs: await getDeliveries("news-log.json", req.query.limit || 50) });
}));

app.get("/logs/market", requireSecret, asyncHandler(async (req, res) => {
  res.json({ ok: true, logs: await getDeliveries("market-log.json", req.query.limit || 50) });
}));

app.post("/test/telegram", requireSecret, asyncHandler(async (req, res) => {
  const text = req.body?.text || "RetroPick Signal Engine test message to Telegram.";
  const result = await sendTelegramMarketMessage(text);
  res.json({ ok: true, platform: "telegram", result });
}));

app.post("/test/discord", requireSecret, asyncHandler(async (req, res) => {
  const content = req.body?.text || "RetroPick Signal Engine test message to Discord.";
  await sendDiscordMarketMessage(content);
  res.json({ ok: true, platform: "discord" });
}));

app.post("/market/test/telegram", requireSecret, asyncHandler(async (req, res) => {
  const text = req.body?.text || "RetroPick Market Bot test message.";
  const result = await sendTelegramMarketMessage(text);
  res.json({ ok: true, channel: "market", platform: "telegram", result });
}));

app.post("/market/test/discord", requireSecret, asyncHandler(async (req, res) => {
  const content = req.body?.text || "RetroPick Market webhook test message.";
  await sendDiscordMarketMessage(content);
  res.json({ ok: true, channel: "market", platform: "discord" });
}));

app.post("/news/test/telegram", requireSecret, asyncHandler(async (req, res) => {
  const text = req.body?.text || "RetroPick News Bot test message.";
  const result = await sendTelegramNewsMessage(text);
  res.json({ ok: true, channel: "news", platform: "telegram", result });
}));

app.post("/news/test/discord", requireSecret, asyncHandler(async (req, res) => {
  const content = req.body?.text || "RetroPick News webhook test message.";
  await sendDiscordNewsMessage(content);
  res.json({ ok: true, channel: "news", platform: "discord" });
}));

app.post("/broadcast/announcement", requireSecret, asyncHandler(async (req, res) => {
  const channel = req.body?.channel || "market";
  const telegramMessage = announcementTemplate(req.body);
  const discordMessage = announcementDiscordTemplate(req.body);
  const platforms = req.body?.platforms || ["telegram", "discord"];
  const selected = new Set(platforms);
  const results = [];

  if (selected.has("telegram")) {
    const sender = channel === "news" ? sendTelegramNewsMessage : sendTelegramMarketMessage;
    results.push(await sender(telegramMessage).then(
      (data) => ({ platform: "telegram", status: "sent", data }),
      (error) => ({ platform: "telegram", status: "failed", error: error.message }),
    ));
  }

  if (selected.has("discord")) {
    const sender = channel === "news" ? sendDiscordNewsMessage : sendDiscordMarketMessage;
    results.push(await sender(discordMessage).then(
      () => ({ platform: "discord", status: "sent" }),
      (error) => ({ platform: "discord", status: "failed", error: error.message }),
    ));
  }

  res.json({ ok: true, results });
}));

async function handleMarketBroadcast(req, res) {
  const market = {
    marketId: req.body?.marketId,
    title: req.body?.title,
    category: req.body?.category || "General",
    marketType: req.body?.marketType || "Prediction",
    url: req.body?.url,
  };

  if (!market.marketId || !market.title || !isValidUrl(market.url)) {
    return res.status(400).json({ ok: false, error: "marketId, title, and valid external url are required" });
  }

  const results = await dispatchMarket(market, req.body?.platforms, {
    skipDuplicates: req.body?.skipDuplicates !== false,
  });
  res.json({ ok: true, marketId: market.marketId, results });
}

app.post("/broadcast/market", requireSecret, asyncHandler(handleMarketBroadcast));
app.post("/market/broadcast", requireSecret, asyncHandler(handleMarketBroadcast));

app.post("/market/jobs/latest", requireSecret, asyncHandler(async (req, res) => {
  const limit = Number(req.body?.limit || 3);
  const platforms = req.body?.platforms || ["telegram", "discord"];
  const category = req.body?.category || "all";
  const result = await runMarketJob({ limit, category, platforms });
  res.json({ ok: true, ...result });
}));

async function handleNewsBroadcast(req, res) {
  const news = {
    title: req.body?.title,
    summary: req.body?.summary,
    url: req.body?.url,
    source: req.body?.source || "External News",
    category: req.body?.category || "Crypto & Macro",
  };

  if (!news.title || !news.url) {
    return res.status(400).json({ ok: false, error: "title and url are required" });
  }

  if (!isValidUrl(news.url)) {
    return res.status(400).json({ ok: false, error: "valid url is required" });
  }

  const marketCategory = classifyNewsItem(news);
  const enrichedNews = {
    ...news,
    marketCategory: req.body?.marketCategory || marketCategory.id,
    marketCategoryLabel: req.body?.marketCategoryLabel || marketCategory.label,
    whyItMatters: req.body?.whyItMatters || marketCategory.whyItMatters,
  };

  const results = await dispatchNews(enrichedNews, req.body?.platforms, {
    skipDuplicates: req.body?.skipDuplicates !== false,
  });
  res.json({ ok: true, newsUrl: enrichedNews.url, marketCategory: enrichedNews.marketCategory, results });
}

app.post("/broadcast/news", requireSecret, asyncHandler(handleNewsBroadcast));
app.post("/news/broadcast", requireSecret, asyncHandler(handleNewsBroadcast));

async function handleNewsLatestJob(req, res) {
  const limit = Number(req.body?.limit || 3);
  const platforms = req.body?.platforms || ["telegram", "discord"];
  const category = req.body?.category || "all";
  const result = await runNewsJob({ limit, category, platforms });
  res.json({ ok: true, ...result });
}

app.post("/jobs/news/latest", requireSecret, asyncHandler(handleNewsLatestJob));
app.post("/news/jobs/latest", requireSecret, asyncHandler(handleNewsLatestJob));

app.get("/market/logs", requireSecret, asyncHandler(async (req, res) => {
  res.json({ ok: true, logs: await getDeliveries("market-log.json", req.query.limit || 50) });
}));

app.get("/news/logs", requireSecret, asyncHandler(async (req, res) => {
  res.json({ ok: true, logs: await getDeliveries("news-log.json", req.query.limit || 50) });
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    ok: false,
    error: error.message || "Internal server error",
  });
});

assertConfig();

const displayHost = host === "0.0.0.0" ? "localhost" : host;

const server = app.listen(port, host, () => {
  console.log("");
  console.log(`RetroPick Signal Engine running at http://${displayHost}:${port}`);
  console.log(`Website: http://${displayHost}:${port}/`);
  console.log(`Admin:   http://${displayHost}:${port}/admin.html`);
  console.log(`Health:  http://${displayHost}:${port}/health`);
  console.log(`Host:    ${host}`);
  console.log("");
  startNewsScheduler(runNewsJob);
  startMarketScheduler(runMarketJob);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error("");
    console.error(`Port ${port} is already in use.`);
    console.error("Stop the old process or run with another port:");
    console.error(`  HOST=0.0.0.0 PORT=4175 npm run dev`);
    console.error("");
    process.exit(1);
  }
  throw error;
});
