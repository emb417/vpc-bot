import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { printWeeklyLeaderboard } from "../../lib/output/leaderboard.js";
import { findCurrentWeek } from "../../services/database.js";

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

    // Check if in valid channel
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

      let raffleList = printWeeklyLeaderboard(
        currentWeek.scores,
        null,
        false,
        false,
      );

      raffleList += "\n\n";
      raffleList += "and the winner is......\n";
      raffleList += `**(${winnerIndex + 1}) ${winner.username}**\n\n`;

      return interaction.reply({
        content: raffleList,
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
