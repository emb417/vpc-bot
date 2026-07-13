import { Listener } from "@sapphire/framework";
import { ObjectId } from "mongodb";
import { findOne, updateOne } from "../../services/database.js";
import logger from "../../utils/logger.js";

export default class RemoveTournamentTableSelectListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "remove_tournament_table_select") return;

    try {
      await interaction.deferUpdate();

      const { tournamentId, vpsId } = JSON.parse(interaction.values[0]);

      const tournament = await findOne(
        { _id: new ObjectId(tournamentId) },
        "tournaments",
      );

      if (!tournament) {
        return interaction.editReply({
          content: "Tournament not found.",
          flags: 64,
        });
      }

      // Check if table exists in the tournament
      if (!tournament.tables?.some(t => t.vpsId === vpsId)) {
        return interaction.editReply({
          content: "Table is not in the tournament.",
          flags: 64,
        });
      }

      // Remove the table
      await updateOne(
        { _id: new ObjectId(tournamentId) },
        { $pull: { tables: { vpsId: vpsId } } },
        {},
        "tournaments"
      );

      return interaction.editReply({
        content: `✅ Table removed from tournament **${tournament.name}**.`,
        components: [],
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to remove tournament table via select menu:");
      return interaction.editReply({
        content: `An error occurred: ${e.message}`,
        flags: 64,
      });
    }
  }
}
