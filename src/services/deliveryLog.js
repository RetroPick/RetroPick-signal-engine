import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const dataDir = path.resolve("data");
const tableName = process.env.SUPABASE_DELIVERIES_TABLE || "signal_deliveries";

function deliveryTypeFromFile(fileName) {
  if (fileName.includes("market")) return "market";
  if (fileName.includes("news")) return "news";
  return fileName.replace(/\.json$/i, "");
}

async function readJson(fileName) {
  try {
    const raw = await readFile(path.join(dataDir, fileName), "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeJson(fileName, entries) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, fileName), JSON.stringify(entries, null, 2));
}

export async function hasDeliveryBeenSent(fileName, key, platform) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from(tableName)
      .select("id")
      .eq("delivery_type", deliveryTypeFromFile(fileName))
      .eq("delivery_key", key)
      .eq("platform", platform)
      .eq("status", "sent")
      .limit(1);

    if (error) throw new Error(`Supabase delivery lookup failed: ${error.message}`);
    return Boolean(data?.length);
  }

  const entries = await readJson(fileName);
  return entries.some((entry) => entry.key === key && entry.platform === platform && entry.status === "sent");
}

export async function saveDelivery(fileName, entry) {
  const sentAt = new Date().toISOString();

  if (isSupabaseConfigured) {
    const { error } = await supabase.from(tableName).insert({
      delivery_type: deliveryTypeFromFile(fileName),
      delivery_key: entry.key,
      platform: entry.platform,
      status: entry.status,
      title: entry.title || null,
      source: entry.source || null,
      url: entry.url || null,
      category: entry.category || entry.market_category || null,
      relevance_score: entry.relevance_score || 0,
      message: entry.message || null,
      error_message: entry.error_message || null,
      payload: entry,
      sent_at: sentAt,
    });

    if (error) throw new Error(`Supabase delivery insert failed: ${error.message}`);
    return;
  }

  const entries = await readJson(fileName);
  entries.unshift({
    ...entry,
    sent_at: sentAt,
  });
  await writeJson(fileName, entries.slice(0, 1000));
}

export async function getDeliveries(fileName, limit = 50) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("delivery_type", deliveryTypeFromFile(fileName))
      .order("sent_at", { ascending: false })
      .limit(Number(limit) || 50);

    if (error) throw new Error(`Supabase delivery list failed: ${error.message}`);

    return (data || []).map((entry) => ({
      key: entry.delivery_key,
      platform: entry.platform,
      status: entry.status,
      title: entry.title,
      source: entry.source,
      url: entry.url,
      category: entry.category,
      relevance_score: entry.relevance_score,
      message: entry.message,
      error_message: entry.error_message,
      sent_at: entry.sent_at,
      payload: entry.payload,
    }));
  }

  const entries = await readJson(fileName);
  return entries.slice(0, Number(limit) || 50);
}
