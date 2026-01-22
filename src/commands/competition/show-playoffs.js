import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { printPlayoffRoundMatchups } from "../../lib/output/tables.js";
import { getCurrentPlayoffMatchups } from "../../lib/playoffs/matchups.js";
import {
  findCurrentWeek,
  findCurrentPlayoff,
  findCurrentPlayoffRound,
} from "../../services/database.js";

const COMPETITION_CHANNEL = process.env.COMPETITION_CHANNEL_NAME;

export class ShowPlayoffsCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-playoffs",
      description: "Show playoffs for the channel.",
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

    // Check if in valid channel
    if (channel.name !== COMPETITION_CHANNEL) {
      return interaction.reply({
        content:
          "This command can only be used in the competition corner channel.",
        flags: 64,
      });
    }

    try {
      const currentPlayoff = await findCurrentPlayoff(channel.name);

      if (!currentPlayoff) {
        return interaction.reply({
          content: "No playoffs found.",
        });
      }

      await this.showPlayoffMatchups(interaction, channel);
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }

  async showPlayoffMatchups(interaction, channel) {
    const currentPlayoff = await findCurrentPlayoff(channel.name);
    const currentPlayoffRound = await findCurrentPlayoffRound(channel.name);
    const currentWeek = await findCurrentWeek(channel.name);

    if (!currentPlayoffRound) {
      return interaction.reply({
        content: "No active playoff round found.",
        flags: 64,
      });
    }

    const games = getCurrentPlayoffMatchups(
      currentWeek,
      currentPlayoff,
      currentPlayoffRound,
    );

    const embeds = printPlayoffRoundMatchups(games);

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
export const getPlayoffRoundMatchups = async (interaction, channel) => {
  const currentPlayoff = await findCurrentPlayoff(channel.name);
  const currentPlayoffRound = await findCurrentPlayoffRound(channel.name);
  const currentWeek = await findCurrentWeek(channel.name);

  if (!currentPlayoff || !currentPlayoffRound) {
    return interaction.reply({
      content: "No active playoffs found.",
      flags: 64,
    });
  }

  const games = getCurrentPlayoffMatchups(
    currentWeek,
    currentPlayoff,
    currentPlayoffRound,
  );

  const embeds = printPlayoffRoundMatchups(games);

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
