import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { findCurrentWeek, updateOne } from "../../services/database.js";

export class RemoveTeamCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "remove-team",
      description: "Remove team from current competition.",
      preconditions: ["CompetitionChannel", "CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName("teamname")
            .setDescription("Name of the team to remove")
            .setRequired(true),
        ),
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;
    const teamName = interaction.options.getString("teamname");

    try {
      const currentWeek = await findCurrentWeek(channel.name);

      if (!currentWeek) {
        return interaction.reply({
          content: "No active week found for this channel.",
          flags: 64,
        });
      }

      const index = currentWeek.teams?.findIndex((x) => x.name === teamName);

      if (index === undefined || index === -1) {
        return interaction.reply({
          content: `Team "${teamName}" not found.`,
          flags: 64,
        });
      }

      currentWeek.teams.splice(index, 1);

      await updateOne(
        { channelName: channel.name, isArchived: false },
        { $set: { teams: currentWeek.teams } },
        null,
        "weeks",
      );

      return interaction.reply({
        content: `Team "${teamName}" removed successfully.`,
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
