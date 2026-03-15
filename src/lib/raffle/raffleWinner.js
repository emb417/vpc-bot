import "dotenv/config";
import { EmbedBuilder } from "discord.js";
import { find } from "../../services/database.js";
import { calculateRaffleData, loadApprovedTables } from "./raffle.js";
import { createWeek } from "../../commands/competition/create-week.js";
import logger from "../../utils/logger.js";
import { showRaffleBoard } from "../../commands/raffle/show-raffle-board.js";

const pickWeightedRaffleWinner = (raffleData) => {
  if (!raffleData || raffleData.length === 0) return null;

  const totalTickets = raffleData.reduce(
    (sum, entry) => sum + entry.tickets,
    0,
  );
  let randomNumber = Math.random() * totalTickets;

  for (const entry of raffleData) {
    if (randomNumber < entry.tickets) return entry;
    randomNumber -= entry.tickets;
  }
  return null;
};

export const runRaffleAndCreateNextWeek = async (client, channel) => {
  try {
    logger.info("Running weekly raffle and creating next week...");

    const allWeeks = await find(
      { channelName: process.env.COMPETITION_CHANNEL_NAME },
      "weeks",
    );
    const currentWeek = allWeeks.find((w) => !w.isArchived);

    if (!currentWeek) {
      logger.warn("No active competition week found for raffle.");
      await channel.send("No active competition week found to run the raffle.");
      return;
    }

    const weekId = currentWeek._id.toString();
    const entries = await find({ weekId }, "raffles");

    // Show the final raffle board
    if (entries && entries.length > 0) {
      const mockInteraction = {
        channel: channel,
        replied: false,
        deferred: false,
        isButton: () => false,
        reply: async (options) => {
          await channel.send(options.content || { embeds: options.embeds });
          return { editReply: async () => {} };
        },
        followUp: async (options) => {
          await channel.send(options.content || { embeds: options.embeds });
          return { editReply: async () => {} };
        },
      };
      await showRaffleBoard(mockInteraction);
      await channel.send("Above is the final raffle board for the week!");
    } else {
      await channel.send("No raffle entries this week. Skipping raffle draw.");
    }

    const approvedTables = await loadApprovedTables();
    const raffleData = calculateRaffleData(allWeeks, entries, approvedTables);

    if (!raffleData || raffleData.length === 0) {
      logger.info("No eligible raffle entries for a draw.");
      await channel.send(
        "No eligible entries to draw a raffle winner this week.",
      );
      return;
    }

    const winner = pickWeightedRaffleWinner(raffleData);

    if (winner) {
      logger.info(
        `Raffle winner selected: ${winner.username} with table ${winner.table.name} (VPS ID: ${winner.table.vpsId})`,
      );

      const winnerEmbed = new EmbedBuilder()
        .setTitle("🎉 Weekly Raffle Winner! 🎉")
        .setDescription(`And the winner is...`)
        .addFields(
          { name: "User", value: `**${winner.username}**`, inline: false },
          {
            name: "Table",
            value: `[${winner.table.name}](${winner.table.url})`,
            inline: false,
          },
        )
        .setColor("Gold");

      await channel.send({
        content: `<@${winner.userId}>`,
        embeds: [winnerEmbed],
      });

      if (process.env.RAFFLE_CREATE_WEEK_ENABLED === "true") {
        const createWeekResult = await createWeek(
          client,
          channel,
          winner.table.vpsId,
          { interaction: null },
        );

        if (createWeekResult.success) {
          logger.info("New competition week created successfully.");
          const week = createWeekResult.week;
          const weekEmbed = new EmbedBuilder()
            .setColor("Green")
            .setTitle(`✅ Week ${week.weekNumber} Created`)
            .setURL(
              `https://discord.com/channels/${process.env.GUILD_ID}/${channel.id}/${process.env.COMPETITION_WEEKLY_POST_ID}`,
            )
            .addFields(
              {
                name: "Table",
                value: week.tableUrl
                  ? `[🔗 ${week.table}](${week.tableUrl})`
                  : week.table,
                inline: false,
              },
              {
                name: "Period",
                value: `${week.periodStart} – ${week.periodEnd}`,
                inline: false,
              },
              {
                name: "ROM",
                value:
                  week.romUrl !== "N/A"
                    ? `[🔗 Required](${week.romUrl})`
                    : "N/A",
                inline: true,
              },
              {
                name: "B2S",
                value:
                  week.b2sUrl !== "N/A"
                    ? `[🔗 Available](${week.b2sUrl})`
                    : "N/A",
                inline: true,
              },
            )
            .setFooter({ text: "Good luck everyone!" });

          await channel.send({ embeds: [weekEmbed] });
        } else {
          logger.error(
            `Failed to create new competition week: ${createWeekResult.message}`,
          );
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor("Red")
                .setDescription(
                  `❌ Failed to start the new competition week: ${createWeekResult.message}`,
                ),
            ],
          });
        }
      } else {
        logger.info(
          "RAFFLE_CREATE_WEEK_ENABLED is not set, skipping week creation.",
        );
      }
    } else {
      logger.warn(
        "Could not pick a raffle winner, even with entries. This should not happen.",
      );
      await channel.send("Error: Could not determine a raffle winner.");
    }
  } catch (error) {
    logger.error("Error during raffle and week creation process:", error);
    await channel.send(
      "An unexpected error occurred during the raffle draw and new week creation. Please check logs.",
    );
  }
};
