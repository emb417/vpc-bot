import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { findOneAndUpdate } from "../../services/database.js";

export class EditTeamNameCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "edit-team-name",
      description: "Edit team name for current competition.",
      preconditions: ["CompetitionChannel", "CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option
              .setName("currentteamname")
              .setDescription("Current team name")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("newteamname")
              .setDescription("New team name")
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;
    const currentTeamName = interaction.options.getString("currentteamname");
    const newTeamName = interaction.options.getString("newteamname");

    try {
      await findOneAndUpdate(
        {
          channelName: channel.name,
          isArchived: false,
          "teams.name": currentTeamName,
        },
        {
          $set: { "teams.$.name": newTeamName },
        },
        null,
        "weeks",
      );

      return interaction.reply({
        content: `Team name updated from "${currentTeamName}" to "${newTeamName}" successfully.`,
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
