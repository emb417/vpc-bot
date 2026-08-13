import cron from "node-cron";
import logger from "../utils/logger.js";
import { runRaffleAndCreateNextWeek } from "../lib/raffle/raffleWinner.js";
import { getTodayPacific } from "../utils/formatting.js";
import { find } from "../services/database.js";
import { endTournament } from "../lib/tournaments/endTournament.js";
import { buildTournamentListEmbed } from "../lib/tournaments/embed.js";

const COMPETITION_CHANNEL_ID = process.env.COMPETITION_CHANNEL_ID;
const GUILD_ID = process.env.GUILD_ID;

async function pinNewTournament(channel, newTournamentMessage, client) {
  const pinsResult = await channel.messages.fetchPins().catch((err) => {
    logger.error({ err }, "Failed to fetch pins:");
    return null;
  });

  if (!pinsResult) return false;

  const pins = pinsResult.items; // Collection of { pinnedAt, message }

  const oldPin = pins.find((item) => {
    const m = item.message;
    return (
      m &&
      m.author.id === client.user.id &&
      m.embeds.length > 0 &&
      m.embeds[0].title === "🏆 Tournament Starting"
    );
  });

  if (oldPin) {
    await oldPin.message.unpin().catch((err) => {
      logger.error({ err }, "Failed to unpin old tournament message:");
    });
  }

  const pinResult = await newTournamentMessage.pin().then(
    () => true,
    (err) => {
      logger.error(
        { err, channelId: channel.id },
        'Failed to pin new tournament message. Check for a channel-specific permission overwrite denying "Pin Messages".',
      );
      return false;
    },
  );

  const recentMessages = await channel.messages.fetch({ limit: 5 });
  const systemPin = recentMessages.find((m) => m.type === 6);
  if (systemPin) await systemPin.delete().catch(() => {});

  return pinResult;
}

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

        // 1. End expired tournaments: fetch only those where endDate < today
        const expired = await find(
          { status: "active", endDate: { $lt: today } },
          "tournaments",
        );

        for (const tournament of expired) {
          try {
            const { winner } = await endTournament(client, tournament);
            if (winner) {
              logger.info(
                `Auto-ended tournament "${tournament.name}" (#${tournament.channelName})` +
                  ` — winner: ${winner.username} (${winner.points} pts)`,
              );
            } else {
              logger.info(
                `Auto-ended tournament "${tournament.name}" (#${tournament.channelName}) (no scores)`,
              );
            }
          } catch (error) {
            logger.error(
              { err: error },
              `Failed to auto-end tournament "${tournament.name}":`,
            );
          }
        }

        // 2. Announce tournaments starting today
        const startingToday = await find(
          { status: "active", startDate: today },
          "tournaments",
        );

        for (const tournament of startingToday) {
          try {
            const guild = await client.guilds.fetch(GUILD_ID);
            const channel = await guild.channels.fetch(tournament.channelId);

            if (channel && channel.isTextBased()) {
              const embed = buildTournamentListEmbed(
                [tournament],
                `🏆 Tournament Starting`,
              );
              const message = await channel.send({ embeds: [embed] });
              const pinned = await pinNewTournament(channel, message, client);
              if (pinned) {
                logger.info(
                  `Announced and pinned tournament "${tournament.name}"`,
                );
              } else {
                logger.warn(
                  `Announced tournament "${tournament.name}" but pin failed — check channel permission overwrite`,
                );
              }
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
