import "dotenv/config";
import { Listener } from "@sapphire/framework";
import { InteractionType } from "discord.js";
import { findCurrentWeek, findOne } from "../../services/database.js";
import { processRaffleEntry } from "../../lib/raffle/entryHandler.js";
import { validateEntry } from "../../lib/raffle/raffle.js";
import { findTable } from "../../lib/data/tables.js";
import logger from "../../utils/logger.js";

export class EnterRaffleModalListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.type !== InteractionType.ModalSubmit) return;
    if (interaction.customId !== "enter-raffle-modal") return;

    const tableInput = interaction.fields
      .getTextInputValue("tableInput")
      .trim();
    const notes = interaction.fields.getTextInputValue("notes").trim() || null;

    const isUrl = tableInput.startsWith("http");
    const vpsId = isUrl ? null : tableInput;
    const url = isUrl ? tableInput : null;

    let currentWeek, table, validation;

    try {
      currentWeek = await findCurrentWeek(process.env.COMPETITION_CHANNEL_NAME);
      if (!currentWeek) {
        return interaction.reply({
          content: "No active competition week found.",
          flags: 64,
        });
      }

      const userId = interaction.user.id;
      const weekId = currentWeek._id.toString();

      const existingEntry = await findOne({ userId, weekId }, "raffles");
      if (existingEntry) {
        return interaction.reply({
          content:
            "You've already entered this week. Use `/change-raffle-entry` to update it.",
          flags: 64,
        });
      }

      const { table: foundTable, error: tableError } = await findTable({
        vpsId,
        url,
      });
      if (tableError)
        return interaction.reply({ content: tableError, flags: 64 });
      if (!foundTable)
        return interaction.reply({ content: "Table not found.", flags: 64 });

      validation = await validateEntry(userId, foundTable, currentWeek);
      if (!validation.valid)
        return interaction.reply({ content: validation.error, flags: 64 });

      table = foundTable;
    } catch (e) {
      logger.error({ err: e }, "Failed to validate enter-raffle modal:");
      return interaction.reply({
        content: "An error occurred while processing your entry.",
        flags: 64,
      });
    }

    // Happy path — public
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
      logger.error({ err: e }, "Failed to process enter-raffle modal:");
      return interaction.editReply({
        content: "An error occurred while processing your entry.",
      });
    }
  }
}
