import "dotenv/config";
import { Listener } from "@sapphire/framework";
import { InteractionType } from "discord.js";
import { findCurrentWeek } from "../../services/database.js";
import { processRaffleEntry } from "../../lib/raffle/entryHandler.js";
import { validateEntry } from "../../lib/raffle/raffle.js";
import { findTable } from "../../lib/data/tables.js";
import logger from "../../utils/logger.js";

export class EnterRaffleButtonListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.type !== InteractionType.MessageComponent) return;
    if (!interaction.customId.startsWith("raffle-enter:")) return;

    const vpsId = interaction.customId.slice("raffle-enter:".length);
    const userId = interaction.user.id;

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

      const { table: foundTable, error: tableError } = await findTable({
        vpsId,
        url: null,
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
    } catch (e) {
      logger.error({ err: e }, "Failed to validate entry:");
      return interaction.reply({
        content: "An error occurred while processing your entry.",
        flags: 64,
      });
    }

    // Slow work — defer before DB writes and qualification checks
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
      logger.error({ err: e }, "Failed to process entry:");
      return interaction.editReply({
        content: "An error occurred while processing your entry.",
      });
    }
  }
}
