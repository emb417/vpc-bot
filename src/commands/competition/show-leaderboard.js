import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { printCombinedLeaderboard } from "../../lib/output/leaderboard.js";
import { findCurrentWeek } from "../../services/database.js";

export class ShowLeaderboardCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-leaderboard",
      description: "Show leaderboard for a competition channel.",
      preconditions: ["CompetitionChannel"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description),
    );
  }

  async chatInputRun(interaction) {
    try {
      const channel = interaction.channel;
      const currentWeek = await findCurrentWeek(channel.name);

      if (!currentWeek) {
        return interaction.reply({
          content: "No active week found for this channel.",
          flags: 64,
        });
      }

      await this.showLeaderboard(
        currentWeek.scores || [],
        currentWeek.teams || [],
        interaction,
      );
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }

  async showLeaderboard(scores, teams, interaction) {
    const contentArray = printCombinedLeaderboard(
      scores,
      null,
      teams,
      false,
      false,
    );

    for (const post of contentArray) {
      if (!interaction.replied) {
        await interaction.reply({ content: post, flags: 64 });
      } else {
        await interaction.followUp({ content: post, flags: 64 });
      }
    }
  }
}

// Export for use by button handlers
export const getLeaderboard = async (interaction, channel) => {
  const currentWeek = await findCurrentWeek(channel.name);
  if (!currentWeek) {
    return interaction.reply({
      content: "No active week found.",
      flags: 64,
    });
  }

  const contentArray = printCombinedLeaderboard(
    currentWeek.scores || [],
    currentWeek.teams || [],
    null,
    false,
    false,
  );

  for (const post of contentArray) {
    if (!interaction.replied) {
      await interaction.reply({ content: post, flags: 64 });
    } else {
      await interaction.followUp({ content: post, flags: 64 });
    }
  }
};
