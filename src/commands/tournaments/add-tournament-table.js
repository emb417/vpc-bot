import { Command } from "@sapphire/framework";
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { getVpsGameById } from "../../lib/data/vps.js";
import { findCurrentlyActiveTournament, find, findOne, updateOne } from "../../services/database.js";
import { ObjectId } from "mongodb";
import { findTable, resolveTableMetadata } from "../../lib/data/tables.js";

const resolveTournamentTable = async (vpsid, tableIndex) => {
  const vpsGame = await getVpsGameById(vpsid);
  const tableFile = vpsGame?.tableFiles?.find((t) => t.id === vpsid);

  if (!tableFile) {
    throw new Error(`No VPS Tables were found for ID: ${vpsid}`);
  }

  return resolveTableMetadata(vpsGame, tableFile, tableIndex);
};

export class AddTournamentTableCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "add-tournament-table",
      description: "Add a table to an active tournament.",
      preconditions: ["ActiveTournamentChannel", "CompetitionAdminRole"],
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
              .setDescription("VPS ID of the table to add")
              .setRequired(true),
          ),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    const channelName = interaction.channel?.name;
    const vpsId = interaction.options.getString("vpsid");

    try {
      const availableTournaments = await find({ channelName, status: "active" }, "tournaments");
      
      if (availableTournaments.length === 0) {
        return interaction.reply({
          content: "No active tournaments found.",
          flags: 64,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("add_tournament_table_select")
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
        content: "Select the tournament to add the table to:",
        components: [row],
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to execute add-tournament-table command:");
      return interaction.reply({ content: e.message, flags: 64 });
    }
  }
}
