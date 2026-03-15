import "dotenv/config";
import { Command } from "@sapphire/framework";
import { findOne, findCurrentWeek } from "../../services/database.js";
import { processRaffleEntry } from "../../lib/raffle/entryHandler.js";
import { validateEntry } from "../../lib/raffle/raffle.js";
import { findTable } from "../../lib/data/tables.js";
import logger from "../../utils/logger.js";

export class ChangeRaffleEntryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "change-raffle-entry",
      description: "Change your weekly raffle table entry.",
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option
              .setName("vpsid")
              .setDescription("New VPS ID")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option.setName("url").setDescription("New URL").setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("notes")
              .setDescription("Optional new notes")
              .setRequired(false),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const vpsId = interaction.options.getString("vpsid");
    const url = interaction.options.getString("url");
    const notes = interaction.options.getString("notes");

    if (!vpsId && !url && !notes) {
      return interaction.reply({
        content: "You must provide at least one field to update.",
        flags: 64,
      });
    }

    // All validation before deferReply so errors can be ephemeral
    let currentWeek, table, validation;
    try {
      currentWeek = await findCurrentWeek(process.env.COMPETITION_CHANNEL_NAME);
      if (!currentWeek) {
        return interaction.reply({
          content: "No active competition week found.",
          flags: 64,
        });
      }

      const weekId = currentWeek._id.toString();
      const userId = interaction.user.id;

      const existingEntry = await findOne({ userId, weekId }, "raffles");
      if (!existingEntry) {
        return interaction.reply({
          content:
            "You haven't entered the weekly raffle yet this week. Use `/enter-raffle`.",
          flags: 64,
        });
      }

      if (vpsId || url) {
        const { table: foundTable, error: tableError } = await findTable({
          vpsId,
          url,
        });
        if (tableError) {
          return interaction.reply({ content: tableError, flags: 64 });
        }
        if (!foundTable) {
          return interaction.reply({ content: "Table not found.", flags: 64 });
        }

        validation = await validateEntry(userId, foundTable, currentWeek);
        if (!validation.valid) {
          return interaction.reply({ content: validation.error, flags: 64 });
        }

        table = foundTable;
      } else {
        // Notes-only update — use existing table, no validation needed
        table = {
          name: existingEntry.table.name,
          url: existingEntry.table.url,
          vpsId: existingEntry.table.vpsId,
          romUrl: existingEntry.table.romUrl,
        };
        validation = { valid: true, warning: null };
      }
    } catch (e) {
      logger.error({ err: e });
      return interaction.reply({
        content: "An error occurred while updating your entry.",
        flags: 64,
      });
    }

    // Slow work — defer before DB writes and qualification checks
    await interaction.deferReply();

    try {
      const payload = await processRaffleEntry({
        userId: interaction.user.id,
        table,
        validation,
        notes,
        username: interaction.user.username,
        avatarURL: interaction.user.displayAvatarURL({
          dynamic: true,
          size: 128,
        }),
        currentWeek,
        client: interaction.client,
      });

      return interaction.editReply(payload);
    } catch (e) {
      logger.error({ err: e });
      return interaction.editReply({
        content: "An error occurred while updating your entry.",
      });
    }
  }
}
