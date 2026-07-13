import { Command } from "@sapphire/framework";
import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { find } from "../../services/database.js";

export class RemoveTournamentTableCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "remove-tournament-table",
      description: "Remove a table from an active tournament.",
      preconditions: ["TournamentChannel", "CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option
              .setName("vpsid")
              .setDescription("VPS ID of the table to remove")
              .setRequired(true),
          ),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    const channelName = interaction.channel?.name;
    const vpsId = interaction.options.getString("vpsid");

    try {
      const tournaments = await find({ channelName, status: "active" }, "tournaments");
      
      // Filter for active tournaments that contain the table
      const availableTournaments = tournaments.filter(t => 
        t.tables?.some(table => table.vpsId === vpsId)
      );

      if (availableTournaments.length === 0) {
        return interaction.reply({
          content: "No active tournaments found that contain that table.",
          flags: 64,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("remove_tournament_table_select")
        .setPlaceholder("Select a tournament")
        .addOptions(
          availableTournaments.map((t) => ({
            label: t.name.slice(0, 100),
            description: `${t.startDate} to ${t.endDate}`,
            value: JSON.stringify({ tournamentId: t._id, vpsId }),
          })),
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);
      return interaction.reply({
        content: "Select the tournament to remove the table from:",
        components: [row],
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to execute remove-tournament-table command:");
      return interaction.reply({ content: e.message, flags: 64 });
    }
  }
}
