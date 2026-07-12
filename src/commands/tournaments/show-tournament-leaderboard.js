import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { printTournamentLeaderboard } from "../../lib/output/leaderboard.js";
import { findCurrentlyActiveTournament } from "../../services/database.js";

export class ShowTournamentLeaderboardCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-tournament-leaderboard",
      description: "Show the overall standings for the active tournament.",
      preconditions: ["TournamentChannel"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: 64 });
    const channel =
      interaction.channel ??
      (await interaction.client.channels.fetch(interaction.channelId));
    return getTournamentLeaderboard(interaction, channel);
  }
}

// Export for use by the button listener and the command above.
export const getTournamentLeaderboard = async (interaction, channel) => {
  try {
    const tournament = await findCurrentlyActiveTournament(channel.name);

    if (!tournament) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setDescription("❌ No active tournament found for this channel."),
        ],
      });
    }

    const embeds = printTournamentLeaderboard(tournament);
    return interaction.editReply({ embeds });
  } catch (e) {
    logger.error({ err: e }, "Failed to show tournament leaderboard:");
    return interaction.editReply({
      embeds: [
        new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
      ],
    });
  }
};
