import "dotenv/config";
import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { findCurrentWeek, find } from "../../services/database.js";
import logger from "../../utils/logger.js";

export const showSelectRaffleEntry = async (interaction) => {
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
    const entries = await find({ weekId }, "raffles");

    // Deduplicate by vpsId
    const seen = new Set();
    const uniqueTables = entries
      .map((e) => e.table)
      .filter((t) => {
        if (seen.has(t.vpsId)) return false;
        seen.add(t.vpsId);
        return true;
      });

    if (uniqueTables.length === 0) {
      return interaction.reply({
        content: "No tables have been entered yet this week.",
        flags: 64,
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId("raffle-select")
      .setPlaceholder("Pick a table to enter")
      .addOptions(
        uniqueTables.map((t) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(t.name)
            .setValue(t.vpsId),
        ),
      );

    return interaction.reply({
      content: "Select a table to enter for this week's raffle:",
      components: [new ActionRowBuilder().addComponents(select)],
      flags: 64,
    });
  } catch (e) {
    logger.error({ err: e }, "Failed to load select-raffle-entry:");
    return interaction.reply({
      content: "An error occurred while loading this week's tables.",
      flags: 64,
    });
  }
};
