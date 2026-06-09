import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

const dataDir = path.resolve("data");
const tableName = process.env.SUPABASE_DELIVERIES_TABLE || "signal_deliveries";
const activeDeliveryLocks = new Set();

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

function toDeliveryRow(fileName, entry, sentAt) {
  return {
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
  };
}

function isUniqueViolation(error) {
  return error?.code === "23505" || String(error?.message || "").toLowerCase().includes("duplicate key");
}

export async function claimDelivery(fileName, entry) {
  const sentAt = new Date().toISOString();
  const claim = { ...entry, status: "sent" };
  const lockKey = `${deliveryTypeFromFile(fileName)}:${entry.key}:${entry.platform}`;

  if (activeDeliveryLocks.has(lockKey)) return false;
  activeDeliveryLocks.add(lockKey);

  if (isSupabaseConfigured) {
    const alreadySent = await hasDeliveryBeenSent(fileName, entry.key, entry.platform);
    if (alreadySent) return false;

    const { error } = await supabase.from(tableName).insert(toDeliveryRow(fileName, claim, sentAt));

    if (isUniqueViolation(error)) return false;
    if (error) {
      activeDeliveryLocks.delete(lockKey);
      throw new Error(`Supabase delivery claim failed: ${error.message}`);
    }
    return true;
  }

  const entries = await readJson(fileName);
  const locked = entries.some((item) => {
    return (
      item.key === entry.key &&
      item.platform === entry.platform &&
      item.status === "sent"
    );
  });

  if (locked) return false;

  entries.unshift({
    ...claim,
    sent_at: sentAt,
  });
  await writeJson(fileName, entries.slice(0, 1000));
  return true;
}

export async function finishDelivery(fileName, key, platform, updates) {
  const sentAt = new Date().toISOString();
  const lockKey = `${deliveryTypeFromFile(fileName)}:${key}:${platform}`;

  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from(tableName)
      .update({
        status: updates.status,
        message: updates.message || null,
        error_message: updates.error_message || null,
        payload: updates.payload || {},
        sent_at: sentAt,
      })
      .eq("delivery_type", deliveryTypeFromFile(fileName))
      .eq("delivery_key", key)
      .eq("platform", platform)
      .eq("status", "sent");

    if (error) throw new Error(`Supabase delivery finish failed: ${error.message}`);
    if (updates.status !== "sent") activeDeliveryLocks.delete(lockKey);
    return;
  }

  const entries = await readJson(fileName);
  const index = entries.findIndex((item) => item.key === key && item.platform === platform && item.status === "sent");
  if (index >= 0) {
    entries[index] = {
      ...entries[index],
      ...updates,
      sent_at: sentAt,
    };
    await writeJson(fileName, entries.slice(0, 1000));
  }
  if (updates.status !== "sent") activeDeliveryLocks.delete(lockKey);
}

export async function saveDelivery(fileName, entry) {
  const sentAt = new Date().toISOString();

  if (isSupabaseConfigured) {
    const { error } = await supabase.from(tableName).insert(toDeliveryRow(fileName, entry, sentAt));

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
