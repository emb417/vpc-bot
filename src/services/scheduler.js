import cron from "node-cron";
import logger from "../utils/logger.js";
import { runRaffleAndCreateNextWeek } from "../lib/raffle/raffleWinner.js";
import { getTodayPacific, tournamentWindowStatus } from "../utils/formatting.js";
import { find } from "../services/database.js";
import { endTournament } from "../lib/tournaments/endTournament.js";
import { buildTournamentEmbed } from "../lib/tournaments/embed.js";

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
        logger.error(
          { err: error },
          "Error during scheduled raffle and week creation:",
        );
      }
    },
    {
      scheduled: true,
      timezone: "America/Los_Angeles",
    },
  );

  // Auto-end any active tournament that has passed its end date, and
  // announce any tournament that is starting today.
  // Runs daily at 12:05 AM Pacific Time.
  cron.schedule(
    process.env.TOURNAMENT_CRON_SCHEDULE || "5 0 * * *",
    async () => {
      logger.info("Running daily tournament maintenance...");
      try {
        const today = getTodayPacific();
        const activeTournaments = await find({ status: "active" }, "tournaments");

        // 1. End expired tournaments
        const expired = activeTournaments.filter(
          (t) => tournamentWindowStatus(t.startDate, t.endDate) === "ended",
        );

        for (const tournament of expired) {
          try {
            const { winner } = await endTournament(client, tournament);
            logger.info(
              `Auto-ended tournament "${tournament.name}" (#${tournament.channelName})` +
                (winner
                  ? ` — winner: ${winner.username} (${winner.points} pts)`
                  : " (no scores)"),
            );
          } catch (error) {
            logger.error(
              { err: error },
              `Failed to auto-end tournament "${tournament.name}":`,
            );
          }
        }

        // 2. Announce tournaments starting today
        const startingToday = activeTournaments.filter(
          (t) => t.startDate === today,
        );

        for (const tournament of startingToday) {
          try {
            const guild = await client.guilds.fetch(GUILD_ID);
            const channel = await guild.channels.fetch(tournament.channelId);

            if (channel && channel.isTextBased()) {
              const embed = buildTournamentEmbed(tournament, {
                title: `🏆 Tournament Starting Today: ${tournament.name}`,
              });
              await channel.send({ embeds: [embed] });
              logger.info(`Announced tournament "${tournament.name}"`);
            }
          } catch (error) {
            logger.error(
              { err: error },
              `Failed to announce tournament "${tournament.name}":`,
            );
          }
        }
      } catch (error) {
        logger.error(
          { err: error },
          "Error during daily tournament maintenance:",
        );
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
