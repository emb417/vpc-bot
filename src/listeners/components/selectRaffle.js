import "dotenv/config";
import { Listener } from "@sapphire/framework";
import { InteractionType, ComponentType } from "discord.js";
import { findCurrentWeek, find } from "../../services/database.js";
import { processRaffleEntry } from "../../lib/raffle/entryHandler.js";
import {
  validateEntry,
  isEntryQualified,
  loadApprovedTables,
} from "../../lib/raffle/raffle.js";
import logger from "../../utils/logger.js";

export class SelectRaffleListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.type !== InteractionType.MessageComponent) return;
    if (interaction.componentType !== ComponentType.StringSelect) return;
    if (interaction.customId !== "raffle-select") return;

    const vpsId = interaction.values[0];
    const userId = interaction.user.id;

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
      const weekEntries = await find({ weekId }, "raffles");

      // Get table data from existing entries — no need to call findTable
      const existingTableEntry = weekEntries.find(
        (e) => e.table.vpsId === vpsId,
      );
      if (!existingTableEntry) {
        return interaction.reply({
          content: "That table is no longer in this week's entries.",
          flags: 64,
        });
      }

      table = existingTableEntry.table;

      validation = await validateEntry(userId, table, currentWeek);
      if (!validation.valid) {
        return interaction.reply({ content: validation.error, flags: 64 });
      }

      if (validation.warning) {
        const approvedTables = await loadApprovedTables();
        const alreadyQualified = isEntryQualified(
          vpsId,
          weekEntries,
          currentWeek.scores ?? [],
          approvedTables,
        );
        if (alreadyQualified) validation.warning = null;
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to validate raffle-select:");
      return interaction.reply({
        content: "An error occurred while processing your entry.",
        flags: 64,
      });
    }

    await interaction.deferReply();

    try {
      const payload = await processRaffleEntry({
        userId,
        table,
        validation,
        notes: null,
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
      logger.error({ err: e }, "Failed to process raffle-select:");
      return interaction.editReply({
        content: "An error occurred while processing your entry.",
      });
    }
  }
}
