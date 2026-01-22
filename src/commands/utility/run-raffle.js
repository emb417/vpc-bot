import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { printWeeklyLeaderboard } from "../../lib/output/leaderboard.js";
import { findCurrentWeek } from "../../services/database.js";
import { EmbedBuilder } from "discord.js";

const COMPETITION_CHANNEL = process.env.COMPETITION_CHANNEL_NAME;

export class RunRaffleCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "run-raffle",
      description: "Run raffle for the current competition.",
      preconditions: ["CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description),
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;

    if (channel.name !== COMPETITION_CHANNEL) {
      return interaction.reply({
        content:
          "This command can only be used in the competition corner channel.",
        flags: 64,
      });
    }

    try {
      const currentWeek = await findCurrentWeek(channel.name);

      if (
        !currentWeek ||
        !currentWeek.scores ||
        currentWeek.scores.length === 0
      ) {
        return interaction.reply({
          content: "No scores found for the current week.",
          flags: 64,
        });
      }

      const participantCount = currentWeek.scores.length;
      const winnerIndex = Math.floor(Math.random() * participantCount);
      const winner = currentWeek.scores[winnerIndex];

      // Weekly leaderboard embeds
      const leaderboardEmbeds = printWeeklyLeaderboard(
        currentWeek.scores,
        null,
        false,
        true,
      );

      // Winner announcement embed
      const winnerEmbed = new EmbedBuilder()
        .setTitle("🎉 Raffle Winner!")
        .setColor("#00cc66")
        .setDescription(
          `and the winner is...\n\n**(#${winnerIndex + 1}) ${winner.username}**`,
        );

      // Send leaderboard first
      for (const embed of leaderboardEmbeds) {
        if (!interaction.replied) {
          await interaction.reply({
            embeds: [embed],
            flags: 64,
          });
        } else {
          await interaction.followUp({
            embeds: [embed],
            flags: 64,
          });
        }
      }

      // Then send winner announcement
      await interaction.followUp({
        embeds: [winnerEmbed],
        flags: 64,
      });
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
