import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
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
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) =>
        builder.setName(this.name).setDescription(this.description),
      {
        guildIds: [guildId],
      },
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
    const embeds = printCombinedLeaderboard(scores, null, teams, false, false);

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

  const embeds = printCombinedLeaderboard(
    currentWeek.scores || [],
    null,
    currentWeek.teams || [],
    false,
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
};
