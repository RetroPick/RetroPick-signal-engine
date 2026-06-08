import cron from "node-cron";

const schedules = [
  ["crypto", process.env.CRON_NEWS_CRYPTO || "*/15 * * * *"],
  ["economics", process.env.CRON_NEWS_ECONOMICS || "*/30 * * * *"],
  ["financials", process.env.CRON_NEWS_FINANCIALS || "*/30 * * * *"],
  ["tech_science", process.env.CRON_NEWS_TECH_SCIENCE || "0 * * * *"],
  ["climate", process.env.CRON_NEWS_CLIMATE || "0 */2 * * *"],
];

export function startNewsScheduler(runNewsJob) {
  if (process.env.ENABLE_NEWS_CRON !== "true") {
    console.log("News cron disabled. Set ENABLE_NEWS_CRON=true to enable scheduled broadcasts.");
    return [];
  }

  return schedules.map(([category, schedule]) => {
    const task = cron.schedule(schedule, async () => {
      try {
        const result = await runNewsJob({
          category,
          limit: Number(process.env.CRON_NEWS_LIMIT || 2),
          platforms: ["telegram", "discord"],
        });
        console.log(`News cron ${category}:`, JSON.stringify(result));
      } catch (error) {
        console.error(`News cron ${category} failed:`, error);
      }
    });
    console.log(`News cron enabled for ${category}: ${schedule}`);
    return task;
  });
}
