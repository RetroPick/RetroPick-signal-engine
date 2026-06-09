import cron from "node-cron";

export function startNewsScheduler(runNewsJob) {
  if (process.env.ENABLE_NEWS_CRON !== "true") {
    console.log("News cron disabled. Set ENABLE_NEWS_CRON=true to enable scheduled broadcasts.");
    return [];
  }

  const schedule = process.env.CRON_NEWS_SCHEDULE || "0 * * * *";
  const category = process.env.CRON_NEWS_CATEGORY || "all";
  const limit = Number(process.env.CRON_NEWS_LIMIT || 1);

  const task = cron.schedule(schedule, async () => {
    try {
      const result = await runNewsJob({
        category,
        limit,
        platforms: ["telegram", "discord"],
      });
      console.log(`News cron ${category}:`, JSON.stringify(result));
    } catch (error) {
      console.error(`News cron ${category} failed:`, error);
    }
  });

  console.log(`News cron enabled for ${category}: ${schedule}`);
  return [task];
}
