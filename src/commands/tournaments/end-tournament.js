import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { findActiveTournament } from "../../services/database.js";
import { endTournament } from "../../lib/tournaments/endTournament.js";

export class EndTournamentCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "end-tournament",
      description: "End the active tournament and announce the winner.",
      preconditions: ["TournamentChannel", "CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;

    try {
      const tournament = await findActiveTournament(channel.name);
      if (!tournament) {
        return interaction.reply({
          content: "No active tournament found for this channel.",
          flags: 64,
        });
      }

      const { winner } = await endTournament(interaction.client, tournament);

      logger.info(
        `Tournament "${tournament.name}" ended in #${channel.name}` +
          (winner
            ? ` — winner: ${winner.username} (${winner.points} pts)`
            : " (no scores)"),
      );

      return interaction.reply({
        content: winner
          ? `🏁 Tournament **${tournament.name}** ended. Winner: **${winner.username}** with ${winner.points} points. Announcement posted.`
          : `🏁 Tournament **${tournament.name}** ended. No scores were posted, so no winner was announced.`,
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to end tournament:");
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
