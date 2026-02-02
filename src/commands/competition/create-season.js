import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { editSeasonCompetitionCornerMessage } from "../../lib/output/messages.js";
import { updateOne, insertOne, find } from "../../services/database.js";

const COMPETITION_CHANNEL = process.env.COMPETITION_CHANNEL_NAME;

export class CreateSeasonCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "create-season",
      description: "Creates new season.",
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
              .setName("seasonnumber")
              .setDescription("Season number")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("seasonname")
              .setDescription("Season name")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("seasonstart")
              .setDescription("Season start date (YYYY-MM-DD)")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("seasonend")
              .setDescription("Season end date (YYYY-MM-DD)")
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
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
      const seasonnumber = interaction.options.getString("seasonnumber");
      const seasonname = interaction.options.getString("seasonname");
      const seasonstart = interaction.options.getString("seasonstart");
      const seasonend = interaction.options.getString("seasonend");

      const season = {
        channelName: channel.name,
        seasonNumber: seasonnumber,
        seasonName: seasonname,
        seasonStart: seasonstart,
        seasonEnd: seasonend,
        isArchived: false,
      };

      // Archive current season
      await updateOne(
        { isArchived: false },
        { $set: { isArchived: true } },
        null,
        "seasons",
      );

      // Insert new season
      await insertOne(season, "seasons");

      // Get weeks in season for leaderboard
      const weeks = await find(
        {
          channelName: channel.name,
          isArchived: true,
          periodStart: { $gte: season.seasonStart },
          periodEnd: { $lte: season.seasonEnd },
        },
        "weeks",
      );

      // Update pinned message
      await editSeasonCompetitionCornerMessage(
        season,
        weeks,
        this.container.client,
      );

      return interaction.reply({
        content: `New season created and the ${COMPETITION_CHANNEL} message was updated successfully.`,
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
