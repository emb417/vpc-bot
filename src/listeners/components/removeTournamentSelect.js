import { Listener } from "@sapphire/framework";
import { ObjectId } from "mongodb";
import { deleteOne, findOne } from "../../services/database.js";
import logger from "../../utils/logger.js";

export default class RemoveTournamentSelectListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "remove_tournament_select") return;

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

      await deleteOne({ _id: new ObjectId(tournamentId) }, "tournaments");

      return interaction.editReply({
        content: `✅ Tournament **${tournament.name}** has been removed.`,
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to remove tournament via select menu:");
      return interaction.editReply({
        content: "An error occurred while removing the tournament.",
        flags: 64,
      });
    }
  }
}
