import cron from "node-cron";

const schedules = [
  ["crypto", process.env.CRON_MARKET_CRYPTO || "0 * * * *"],
  ["economics", process.env.CRON_MARKET_ECONOMICS || "0 * * * *"],
  ["financials", process.env.CRON_MARKET_FINANCIALS || "0 * * * *"],
  ["tech_science", process.env.CRON_MARKET_TECH_SCIENCE || "0 * * * *"],
  ["climate", process.env.CRON_MARKET_CLIMATE || "0 * * * *"],
];

export function startMarketScheduler(runMarketJob) {
  if (process.env.ENABLE_MARKET_CRON !== "true") {
    console.log("Market cron disabled. Set ENABLE_MARKET_CRON=true to enable scheduled broadcasts.");
    return [];
  }

  return schedules.map(([category, schedule]) => {
    const task = cron.schedule(schedule, async () => {
      try {
        const result = await runMarketJob({
          category,
          limit: Number(process.env.CRON_MARKET_LIMIT || 2),
          platforms: ["telegram", "discord"],
        });
        console.log(`Market cron ${category}:`, JSON.stringify(result));
      } catch (error) {
        console.error(`Market cron ${category} failed:`, error);
      }
    });
    console.log(`Market cron enabled for ${category}: ${schedule}`);
    return task;
  });
}
