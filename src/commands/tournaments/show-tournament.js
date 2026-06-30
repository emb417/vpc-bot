import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { buildTournamentEmbed } from "../../lib/tournaments/embed.js";
import { findActiveTournament } from "../../services/database.js";

export class ShowTournamentCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-tournament",
      description: "Show the active tournament for this channel and its tables.",
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
    await interaction.deferReply();

    try {
      const tournament = await findActiveTournament(interaction.channel.name);

      if (!tournament) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setDescription("❌ No active tournament found for this channel."),
          ],
        });
      }

      const embed = buildTournamentEmbed(tournament, {
        title: `🏆 ${tournament.name}`,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      logger.error({ err: e }, "Failed to show tournament:");
      return interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
        ],
      });
    }
  }
}
