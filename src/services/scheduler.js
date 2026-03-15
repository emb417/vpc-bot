import cron from "node-cron";
import logger from "../utils/logger.js";
import { runRaffleAndCreateNextWeek } from "../lib/raffle/raffleWinner.js";

const COMPETITION_CHANNEL_ID = process.env.COMPETITION_CHANNEL_ID;
const GUILD_ID = process.env.GUILD_ID;

/**
 * Initializes and starts all scheduled tasks.
 * @param {Client} client - The Discord client.
 */
export const initScheduledJobs = (client) => {
  logger.info("Initializing scheduled jobs...");

  // Schedule the raffle and new week creation for every Monday at 12:00 AM Pacific Time (PT)
  cron.schedule(
    process.env.WEEKLY_CRON_SCHEDULE || "0 0 * * 1",
    async () => {
      logger.info("Running scheduled raffle and new week creation...");
      try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const channel = await guild.channels.fetch(COMPETITION_CHANNEL_ID);

        if (!channel || !channel.isTextBased()) {
          logger.error(
            "Competition channel not found or is not a text channel.",
          );
          return;
        }

        await runRaffleAndCreateNextWeek(client, channel);
      } catch (error) {
        logger.error("Error during scheduled raffle and week creation:", error);
      }
    },
    {
      scheduled: true,
      timezone: "America/Los_Angeles",
    },
  );

  logger.info("Scheduled jobs initialized.");
};

export default {
  initScheduledJobs,
};
