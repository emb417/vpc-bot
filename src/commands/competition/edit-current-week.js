import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { editWeeklyCompetitionCornerMessage } from "../../lib/output/messages.js";
import { findOneAndUpdate } from "../../services/database.js";

export class EditCurrentWeekCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "edit-current-week",
      description: "Edit current week.",
      preconditions: ["CompetitionChannel", "CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addIntegerOption((option) =>
          option.setName("weeknumber").setDescription("Week number"),
        )
        .addStringOption((option) =>
          option
            .setName("periodstart")
            .setDescription("Period start (YYYY-MM-DD)"),
        )
        .addStringOption((option) =>
          option.setName("periodend").setDescription("Period end (YYYY-MM-DD)"),
        )
        .addStringOption((option) =>
          option.setName("table").setDescription("Table name"),
        )
        .addStringOption((option) =>
          option.setName("authorname").setDescription("Author name"),
        )
        .addStringOption((option) =>
          option.setName("versionnumber").setDescription("Version number"),
        )
        .addStringOption((option) =>
          option.setName("mode").setDescription("Game mode"),
        )
        .addStringOption((option) =>
          option.setName("tableurl").setDescription("Table URL"),
        )
        .addStringOption((option) =>
          option.setName("vpsid").setDescription("VPS ID"),
        )
        .addStringOption((option) =>
          option.setName("romurl").setDescription("ROM URL"),
        )
        .addStringOption((option) =>
          option.setName("romname").setDescription("ROM name"),
        )
        .addStringOption((option) =>
          option.setName("b2surl").setDescription("B2S URL"),
        )
        .addIntegerOption((option) =>
          option.setName("season").setDescription("Season number"),
        )
        .addIntegerOption((option) =>
          option
            .setName("currentseasonweeknumber")
            .setDescription("Current season week number"),
        )
        .addStringOption((option) =>
          option.setName("notes").setDescription("Notes"),
        ),
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;

    try {
      const updatedWeek = {};

      // Collect all provided options
      const weekNumber = interaction.options.getInteger("weeknumber");
      const periodStart = interaction.options.getString("periodstart");
      const periodEnd = interaction.options.getString("periodend");
      const table = interaction.options.getString("table");
      const authorName = interaction.options.getString("authorname");
      const versionNumber = interaction.options.getString("versionnumber");
      const mode = interaction.options.getString("mode");
      const tableUrl = interaction.options.getString("tableurl");
      const vpsId = interaction.options.getString("vpsid");
      const romUrl = interaction.options.getString("romurl");
      const romName = interaction.options.getString("romname");
      const b2sUrl = interaction.options.getString("b2surl");
      const season = interaction.options.getInteger("season");
      const currentSeasonWeekNumber = interaction.options.getInteger(
        "currentseasonweeknumber",
      );
      const notes = interaction.options.getString("notes");

      // Only include fields that were provided
      if (weekNumber !== null) updatedWeek.weekNumber = weekNumber;
      if (periodStart) updatedWeek.periodStart = periodStart;
      if (periodEnd) updatedWeek.periodEnd = periodEnd;
      if (table) updatedWeek.table = table;
      if (authorName) updatedWeek.authorName = authorName;
      if (versionNumber) updatedWeek.versionNumber = versionNumber;
      if (mode) updatedWeek.mode = mode;
      if (tableUrl) updatedWeek.tableUrl = tableUrl;
      if (vpsId) updatedWeek.vpsId = vpsId;
      if (romUrl) updatedWeek.romUrl = romUrl;
      if (romName) updatedWeek.romName = romName;
      if (b2sUrl) updatedWeek.b2sUrl = b2sUrl;
      if (season !== null) updatedWeek.season = season;
      if (currentSeasonWeekNumber !== null)
        updatedWeek.currentSeasonWeekNumber = currentSeasonWeekNumber;
      if (notes) updatedWeek.notes = notes;

      if (Object.keys(updatedWeek).length === 0) {
        return interaction.reply({
          content: "No fields provided to update.",
          flags: 64,
        });
      }

      const week = await findOneAndUpdate(
        { channelName: channel.name, isArchived: false },
        { $set: updatedWeek },
        { returnDocument: "after" },
        "weeks",
      );

      if (channel.name === process.env.COMPETITION_CHANNEL_NAME) {
        await editWeeklyCompetitionCornerMessage(
          week.scores,
          this.container.client,
          week,
          week.teams,
        );
        return interaction.reply({
          content: "Weekly Leaderboard pinned message updated successfully.",
          flags: 64,
        });
      } else {
        return interaction.reply({
          content: `Week updated for the ${channel.name} channel.`,
          flags: 64,
        });
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
