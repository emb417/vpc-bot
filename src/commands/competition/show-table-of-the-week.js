import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { getCurrentWeek } from "../../lib/data/vpc.js";
import { createCompetitionWeekEmbed } from "../../lib/output/messages.js";

export class ShowTableOfTheWeekCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-table-of-the-week",
      description: "Show the current table of the week and its details.",
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
      const week = await getCurrentWeek(process.env.COMPETITION_CHANNEL_NAME);

      if (!week) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setDescription("❌ No active week found for this channel."),
          ],
        });
      }

      return interaction.editReply({
        embeds: [createCompetitionWeekEmbed(week)],
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to show table of the week:");
      return interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
        ],
      });
    }
  }
}
