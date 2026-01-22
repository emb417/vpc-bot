import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { findOne, updateOne } from "../../services/database.js";

export class CreateTeamCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "create-team",
      description: "Create teams for competition.",
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
            .setName("team")
            .setDescription("Team definition (TeamName:member1,member2,...)")
            .setRequired(true),
        ),
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;
    const team = interaction.options.getString("team");

    try {
      const teamName = team.substring(0, team.indexOf(":"));
      const members = team.substring(team.indexOf(":") + 1).split(",");

      if (!teamName || members.length === 0) {
        return interaction.reply({
          content: "Invalid team format. Use: TeamName:member1,member2,...",
          flags: 64,
        });
      }

      const existingTeam = await findOne(
        {
          channelName: channel.name,
          isArchived: false,
          "teams.name": teamName,
        },
        "weeks",
      );

      if (existingTeam) {
        // Update existing team
        await updateOne(
          {
            channelName: channel.name,
            isArchived: false,
            "teams.name": teamName,
          },
          { $set: { "teams.$.members": members } },
          null,
          "weeks",
        );
      } else {
        // Add new team
        const newTeam = {
          name: teamName,
          members: members,
        };
        await updateOne(
          { channelName: channel.name, isArchived: false },
          { $push: { teams: newTeam } },
          null,
          "weeks",
        );
      }

      // Create text table for display
      const header = teamName;
      const rows = members.map((m) => `| ${m} |`).join("\n");

      const table = `| ${header} |\n${rows}`;

      return interaction.reply({
        content: `Team created successfully.\n\n${table}`,
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
