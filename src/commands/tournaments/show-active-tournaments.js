import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { buildTournamentListEmbed } from "../../lib/tournaments/embed.js";
import { findActiveTournaments } from "../../services/database.js";

export class ShowActiveCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-active-tournaments",
      description: "Show a list of all live tournaments.",
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

    try {
      // List all live tournaments
      const allLive = await findActiveTournaments();

      if (!allLive || allLive.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Blue")
              .setDescription("ℹ️ No active tournaments found."),
          ],
        });
      }

      const embed = buildTournamentListEmbed(allLive, "🏆 Active Tournaments");

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      logger.error({ err: e }, "Failed to show tournaments:");
      return interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
        ],
      });
    }
  }
}
