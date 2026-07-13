import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { findTable } from "../../lib/data/tables.js";
import { find, findCurrentlyActiveTournament, updateOne } from "../../services/database.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value) => {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && value === d.toISOString().slice(0, 10);
};

export class EditTournamentCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "edit-tournament",
      description:
        "Edit the active tournament's ROM info, dates, or notes.",
      preconditions: ["TournamentChannel", "CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option
              .setName("table")
              .setDescription("Table to edit ROM info for (needed for ROM changes)")
              .setRequired(false)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("romname")
              .setDescription("New ROM name/version for the selected table")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("romurl")
              .setDescription("New ROM download URL for the selected table")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("mode")
              .setDescription("New game mode for the selected table")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("startdate")
              .setDescription("New start date (YYYY-MM-DD)")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("enddate")
              .setDescription("New end date (YYYY-MM-DD)")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("notes")
              .setDescription("Notes for the tournament")
              .setRequired(false),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async autocompleteRun(interaction) {
    const channelName = interaction.channel?.name;
    const tournament = channelName
      ? await findCurrentlyActiveTournament(channelName)
      : null;

    if (!tournament) {
      return interaction.respond([]);
    }

    const focused = interaction.options.getFocused().toLowerCase();
    const choices = (tournament.tables ?? [])
      .filter((t) => !focused || t.table.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((t) => ({
        name: t.table.slice(0, 100),
        value: String(t.tableIndex),
      }));

    return interaction.respond(choices);
  }

  async chatInputRun(interaction) {
    const channelName = interaction.channel?.name;

    try {
      if (!channelName) {
        return interaction.reply({
          content: "Could not determine the channel name.",
          flags: 64,
        });
      }

      const tournaments = await find(
        { channelName: channelName, status: "active" },
        "tournaments",
      );

      if (!tournaments || tournaments.length === 0) {
        return interaction.reply({
          content: "No active tournaments found for this channel.",
          flags: 64,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("edit_tournament_select")
        .setPlaceholder("Select a tournament to edit")
        .addOptions(
          tournaments.slice(0, 25).map((t) => ({
            label: t.name.slice(0, 100),
            description: `${t.startDate} to ${t.endDate}`,
            value: String(t._id),
          })),
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return interaction.reply({
        content: "Please select the tournament you wish to edit:",
        components: [row],
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to execute edit-tournament command:");
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
