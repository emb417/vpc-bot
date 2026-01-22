import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { printSeasonLeaderboard } from "../../lib/output/leaderboard.js";
import { findOne, find } from "../../services/database.js";

const COMPETITION_CHANNEL = process.env.COMPETITION_CHANNEL_NAME;

export class ShowSeasonLeaderboardCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-season-leaderboard",
      description: "Show season leaderboard for the Competition Corner.",
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

    if (channel.name !== COMPETITION_CHANNEL) {
      return interaction.reply({
        content:
          "This command can only be used in the competition corner channel.",
        flags: 64,
      });
    }

    try {
      const currentSeason = await findOne(
        {
          channelName: channel.name,
          isArchived: false,
        },
        "seasons",
      );

      if (!currentSeason) {
        return interaction.reply({
          content: "No season found.",
          flags: 64,
        });
      }

      await this.showSeasonLeaderboard(channel, interaction, currentSeason);
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }

  async showSeasonLeaderboard(channel, interaction, currentSeason) {
    const weeks = await find(
      {
        channelName: channel.name,
        isArchived: true,
        periodStart: { $gte: currentSeason.seasonStart },
        periodEnd: { $lte: currentSeason.seasonEnd },
      },
      "weeks",
    );

    const embeds = printSeasonLeaderboard(weeks, null, false);

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

// Export for use by other modules
export const getSeasonLeaderboard = async (channel, interaction) => {
  const currentSeason = await findOne(
    {
      channelName: channel.name,
      isArchived: false,
    },
    "seasons",
  );

  if (!currentSeason) {
    return interaction.reply({
      content: "No season found.",
      flags: 64,
    });
  }

  const weeks = await find(
    {
      channelName: channel.name,
      isArchived: true,
      periodStart: { $gte: currentSeason.seasonStart },
      periodEnd: { $lte: currentSeason.seasonEnd },
    },
    "weeks",
  );

  const embeds = printSeasonLeaderboard(weeks, null, false);

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
