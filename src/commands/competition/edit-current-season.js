import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { editSeasonCompetitionCornerMessage } from "../../lib/output/messages.js";
import { findOneAndUpdate, find } from "../../services/database.js";

const COMPETITION_CHANNEL = process.env.COMPETITION_CHANNEL_NAME;

export class EditCurrentSeasonCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "edit-current-season",
      description: "Edit the current season.",
      preconditions: ["CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option.setName("seasonnumber").setDescription("Season number"),
        )
        .addStringOption((option) =>
          option.setName("seasonname").setDescription("Season name"),
        )
        .addStringOption((option) =>
          option
            .setName("seasonstart")
            .setDescription("Season start (YYYY-MM-DD)"),
        )
        .addStringOption((option) =>
          option.setName("seasonend").setDescription("Season end (YYYY-MM-DD)"),
        ),
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
      const seasonNumber = interaction.options.getString("seasonnumber");
      const seasonName = interaction.options.getString("seasonname");
      const seasonStart = interaction.options.getString("seasonstart");
      const seasonEnd = interaction.options.getString("seasonend");

      const updatedSeason = {};

      if (seasonNumber) updatedSeason.seasonNumber = seasonNumber;
      if (seasonName) updatedSeason.seasonName = seasonName;
      if (seasonStart) updatedSeason.seasonStart = seasonStart;
      if (seasonEnd) updatedSeason.seasonEnd = seasonEnd;

      if (Object.keys(updatedSeason).length === 0) {
        return interaction.reply({
          content: "No fields provided to update.",
          flags: 64,
        });
      }

      const updatedDoc = await findOneAndUpdate(
        { isArchived: false },
        { $set: updatedSeason },
        { returnDocument: "after" },
        "seasons",
      );

      const weeks = await find(
        {
          channelName: channel.name,
          isArchived: true,
          periodStart: { $gte: updatedDoc.seasonStart },
          periodEnd: { $lte: updatedDoc.seasonEnd },
        },
        "weeks",
      );

      await editSeasonCompetitionCornerMessage(
        updatedDoc,
        weeks,
        this.container.client,
      );

      return interaction.reply({
        content: "Season has been updated.",
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
