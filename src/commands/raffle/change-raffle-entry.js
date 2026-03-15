import "dotenv/config";
import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import {
  updateOne,
  find,
  findOne,
  findCurrentWeek,
} from "../../services/database.js";
import {
  validateEntry,
  isEntryQualified,
  loadApprovedTables,
  notifyQualificationChange,
} from "../../lib/raffle/raffle.js";
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

    try {
      const currentWeek = await findCurrentWeek(
        process.env.COMPETITION_CHANNEL_NAME,
      );
      if (!currentWeek) {
        return interaction.reply({
          content: "No active competition week found.",
          flags: 64,
        });
      }

      const weekId = currentWeek._id.toString();
      const userId = interaction.user.id;

      // Check if entry exists
      const existingEntry = await findOne({ userId, weekId }, "raffles");
      if (!existingEntry) {
        return interaction.reply({
          content:
            "You haven't entered the weekly raffle yet this week. Use `/enter-raffle`.",
          flags: 64,
        });
      }

      let updateData = { updatedAt: new Date() };
      let tableName = existingEntry.table.name;
      let validation = null;

      if (vpsId || url) {
        const { table, error: tableError } = await findTable({ vpsId, url });
        if (tableError) {
          return interaction.reply({ content: tableError, flags: 64 });
        }
        if (!table) {
          return interaction.reply({
            content:
              "Table not found. This should have been caught by specific errors.",
            flags: 64,
          });
        }

        validation = await validateEntry(userId, table, currentWeek);
        if (!validation.valid) {
          return interaction.reply({ content: validation.error, flags: 64 });
        }

        updateData.table = {
          name: table.name,
          url: table.url,
          vpsId: table.vpsId,
          romUrl: table.romUrl,
          notes: notes || null,
        };
        tableName = table.name;
      }

      // Pre-change qualification state
      const tableIsChanging = !!(
        updateData.table && updateData.table.vpsId !== existingEntry.table.vpsId
      );
      let approvedTables = null;
      let oldWasQualified = null;
      let newWasQualified = null;

      if (tableIsChanging) {
        approvedTables = await loadApprovedTables();
        const weekEntriesBefore = await find({ weekId }, "raffles");

        oldWasQualified = isEntryQualified(
          existingEntry.table.vpsId,
          weekEntriesBefore,
          currentWeek.scores ?? [],
          approvedTables,
        );

        newWasQualified = isEntryQualified(
          updateData.table.vpsId,
          weekEntriesBefore,
          currentWeek.scores ?? [],
          approvedTables,
        );
      }

      await updateOne(
        { userId, weekId },
        { $set: updateData },
        null,
        "raffles",
      );

      if (tableIsChanging) {
        // Fetch fresh entries post-update so the moved entry is on the correct table
        const weekEntriesAfter = await find({ weekId }, "raffles");

        const oldNowQualified = isEntryQualified(
          existingEntry.table.vpsId,
          weekEntriesAfter,
          currentWeek.scores ?? [],
          approvedTables,
        );

        const newNowQualified = isEntryQualified(
          updateData.table.vpsId,
          weekEntriesAfter,
          currentWeek.scores ?? [],
          approvedTables,
        );

        if (newNowQualified) {
          validation.warning = null;
        }

        notifyQualificationChange(
          this.container.client,
          process.env.COMPETITION_CHANNEL_ID,
          existingEntry.table,
          weekEntriesAfter.filter(
            (e) => e.table.vpsId === existingEntry.table.vpsId,
          ),
          oldWasQualified,
          oldNowQualified,
        ).catch((e) =>
          logger.error("notifyQualificationChange (old table) error:", e),
        );

        notifyQualificationChange(
          this.container.client,
          process.env.COMPETITION_CHANNEL_ID,
          updateData.table,
          weekEntriesAfter.filter(
            (e) => e.table.vpsId === updateData.table.vpsId,
          ),
          newWasQualified,
          newNowQualified,
        ).catch((e) =>
          logger.error("notifyQualificationChange (new table) error:", e),
        );
      }

      const embed = new EmbedBuilder()
        .setTitle("🎟 Changed Raffle Entry")
        .setDescription(
          `**${interaction.user.username}** changed to\n[${tableName}](${updateData.table?.url ?? existingEntry.table.url})${validation?.warning ? `\n\n⏳ ${validation.warning}` : ""}`,
        )
        .setColor(validation?.warning ? "Yellow" : "Green")
        .setThumbnail(
          interaction.user.displayAvatarURL({ dynamic: true, size: 128 }),
        )
        .setFooter({
          text: "Use /change-raffle-entry to change your entry.",
        });

      const raffleBoardButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("show_raffle_board")
          .setLabel("Show Raffle Board")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("show_raffle_rules")
          .setLabel("Show Raffle Rules")
          .setStyle(ButtonStyle.Secondary),
      );

      return interaction.reply({
        embeds: [embed],
        components: [raffleBoardButtons],
      });
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: "An error occurred while updating your entry.",
        flags: 64,
      });
    }
  }
}
