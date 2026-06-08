import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("data");

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
  const entries = await readJson(fileName);
  return entries.some((entry) => entry.key === key && entry.platform === platform && entry.status === "sent");
}

export async function saveDelivery(fileName, entry) {
  const entries = await readJson(fileName);
  entries.unshift({
    ...entry,
    sent_at: new Date().toISOString(),
  });
  await writeJson(fileName, entries.slice(0, 1000));
}

export async function getDeliveries(fileName, limit = 50) {
  const entries = await readJson(fileName);
  return entries.slice(0, Number(limit) || 50);
}
