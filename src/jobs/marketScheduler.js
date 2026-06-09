import cron from "node-cron";

export function startMarketScheduler(runMarketJob) {
  if (process.env.ENABLE_MARKET_CRON !== "true") {
    console.log("Market cron disabled. Set ENABLE_MARKET_CRON=true to enable scheduled broadcasts.");
    return [];
  }

  const schedule = process.env.CRON_MARKET_SCHEDULE || "0 * * * *";
  const category = process.env.CRON_MARKET_CATEGORY || "all";
  const limit = Number(process.env.CRON_MARKET_LIMIT || 1);

  const task = cron.schedule(schedule, async () => {
    try {
      const result = await runMarketJob({
        category,
        limit,
        platforms: ["telegram", "discord"],
      });
      console.log(`Market cron ${category}:`, JSON.stringify(result));
    } catch (error) {
      console.error(`Market cron ${category} failed:`, error);
    }
  });

  console.log(`Market cron enabled for ${category}: ${schedule}`);
  return [task];
}
