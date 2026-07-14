import { Listener } from "@sapphire/framework";
import { ObjectId } from "mongodb";
import { findOne } from "../../services/database.js";
import { findTable } from "../../lib/data/tables.js";
import logger from "../../utils/logger.js";

export default class EditTournamentSelectListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "edit_tournament_select") return;

    try {
      await interaction.deferUpdate();

      const tournamentId = interaction.values[0];

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

      // Synchronize tables
      for (const table of tournament.tables ?? []) {
        await findTable({ vpsId: table.vpsId });
      }

      return interaction.editReply({
        content: `✅ Tournament **${tournament.name}** tables synchronized.`,
        components: [],
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to edit tournament via select menu:");
      return interaction.editReply({
        content: "An error occurred while selecting the tournament.",
        flags: 64,
      });
    }
  }
}
