import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { find } from "../../services/database.js";
import { getTodayPacific } from "../../utils/formatting.js";
import { buildTournamentListEmbed } from "../../lib/tournaments/embed.js";

export class ShowUpcomingCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-upcoming-tournaments",
      description: "Show a list of upcoming tournaments.",
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
      const today = getTodayPacific();
      const upcomingTournaments = await find(
        { startDate: { $gt: today } },
        "tournaments",
      ).then((docs) =>
        docs.sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );

      if (!upcomingTournaments || upcomingTournaments.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Blue")
              .setDescription("ℹ️ No upcoming tournaments found."),
          ],
        });
      }

      const embed = buildTournamentListEmbed(
        upcomingTournaments,
        "📅 Upcoming Tournaments",
      );

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      logger.error({ err: e }, "Failed to show upcoming tournaments:");
      return interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
        ],
      });
    }
  }
}
