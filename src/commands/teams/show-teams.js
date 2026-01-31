import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { printTeamLeaderboard } from "../../lib/output/leaderboard.js";
import { findCurrentWeek } from "../../services/database.js";

export class ShowTeamsCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-teams",
      description: "Show teams for current competition.",
      preconditions: ["CompetitionChannel"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description),
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;

    try {
      const currentWeek = await findCurrentWeek(channel.name);

      if (!currentWeek) {
        return interaction.reply({
          content: "No active week found for this channel.",
          flags: 64,
        });
      }

      if (!currentWeek.teams || currentWeek.teams.length === 0) {
        return interaction.reply({
          content: "No teams were found.",
          flags: 64,
        });
      }

      const embeds = printTeamLeaderboard(
        currentWeek.scores || [],
        currentWeek.teams,
        false,
      );

      for (const embed of embeds) {
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
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
