import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { ObjectId } from "mongodb";
import logger from "../../utils/logger.js";
import { findTable } from "../../lib/data/tables.js";
import { find, findOne, findCurrentlyActiveTournament, findOverlappingTournament, updateOne } from "../../services/database.js";

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
      preconditions: ["ActiveTournamentChannel", "CompetitionAdminRole"],
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
              .setName("tournament")
              .setDescription("The tournament to edit")
              .setRequired(false)
              .setAutocomplete(true),
          )
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
    if (!channelName) {
      return interaction.respond([]);
    }

    const focusedOption = interaction.options.getFocused(true);
    const focusedValue = interaction.options.getFocused();

    if (!focusedOption) {
      return interaction.respond([]);
    }

    const optionName = typeof focusedOption === 'object' ? focusedOption.name : focusedOption;

    if (optionName === "tournament") {
      const tournaments = await find({ channelName, status: "active" }, "tournaments");

      const search = focusedValue.toLowerCase();

      const filtered = tournaments
        .filter((t) => !search || t.name.toLowerCase().includes(search))
        .slice(0, 25)
        .map((t) => ({
          name: t.name.slice(0, 100),
          value: String(t._id),
        }));
      
      return interaction.respond(filtered);
    }

    if (optionName === "table") {
      const tournamentId = interaction.options.getString("tournament");
      let tournament = null;

      if (tournamentId) {
        tournament = await findOne({ _id: new ObjectId(tournamentId) }, "tournaments");
      } else {
        tournament = await findCurrentlyActiveTournament(channelName);
      }

      if (!tournament) {
        return interaction.respond([]);
      }

      const search = focusedValue.toLowerCase();
      const choices = (tournament.tables ?? [])
        .filter((t) => !search || t.table.toLowerCase().includes(search))
        .slice(0, 25)
        .map((t) => ({
          name: t.table.slice(0, 100),
          value: String(t.tableIndex),
        }));

      return interaction.respond(choices);
    }

    return interaction.respond([]);
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

      const tournamentId = interaction.options.getString("tournament");

      if (tournamentId) {
        const tournament = await findOne(
          { _id: new ObjectId(tournamentId) },
          "tournaments",
        );

        if (!tournament) {
          return interaction.reply({
            content: "Tournament not found.",
            flags: 64,
          });
        }

        // Synchronize all tables for this tournament
        const updates = {};
        const changeLog = [];

        for (const table of tournament.tables ?? []) {
          const { table: syncedTable, error } = await findTable({ vpsId: table.vpsId });
          
          if (!error && syncedTable) {
            const currentVersion = table.versionNumber;
            const newVersion = syncedTable.metadata.versionNumber;
            
            if (newVersion !== currentVersion) {
              logger.info(`Version mismatch for ${table.table}: ${currentVersion} -> ${newVersion}. Resetting scores.`);
              
              // Update table metadata
              table.versionNumber = newVersion;
              table.authorName = syncedTable.metadata.authorName;
              table.tableUrl = syncedTable.url;
              table.romName = syncedTable.romName || table.romName; // Keep existing if not found
              table.romUrl = syncedTable.romUrl || table.romUrl;
              
              // Reset scores
              table.scores = [];
              
              changeLog.push(`Table ${table.table}: Updated to v${newVersion} and scores reset.`);
              updates.tables = tournament.tables;
            }
          }
        }

        const startdate = interaction.options.getString("startdate");
        const enddate = interaction.options.getString("enddate");
        const notes = interaction.options.getString("notes");

        if (startdate && isValidDate(startdate) && startdate !== tournament.startDate) {
          updates.startDate = startdate;
          changeLog.push(`Start Date: ${tournament.startDate} → ${startdate}`);
        }

        if (enddate && isValidDate(enddate) && enddate !== tournament.endDate) {
          updates.endDate = enddate;
          changeLog.push(`End Date: ${tournament.endDate} → ${enddate}`);
        }

        if (notes !== null && notes !== undefined && notes !== tournament.notes) {
          updates.notes = notes;
          changeLog.push(`Notes: ${tournament.notes ?? "None"} → ${notes ?? "None"}`);
        }

        if (startdate || enddate) {
          const sDate = startdate || tournament.startDate;
          const eDate = enddate || tournament.endDate;
          const overlap = await findOverlappingTournament(
            channelName,
            sDate,
            eDate,
            tournament._id,
          );
          if (overlap) {
            return interaction.reply({
              content: `❌ Date overlap detected with tournament: **${overlap.name}** (${overlap.startDate} to ${overlap.endDate}).`,
              flags: 64,
            });
          }
        }

        const tableIndexStr = interaction.options.getString("table");
        if (tableIndexStr) {
          const tableIndex = parseInt(tableIndexStr, 10);
          const table = tournament.tables?.find((t) => t.tableIndex === tableIndex);

          if (!table) {
            return interaction.reply({
              content: "Selected table not found in this tournament.",
              flags: 64,
            });
          }

          const romname = interaction.options.getString("romname");
          const romurl = interaction.options.getString("romurl");
          const mode = interaction.options.getString("mode");

          if (romname && romname !== table.romName) {
            table.romName = romname;
            changeLog.push(`Table ${table.table}: ROM Name ${table.romName} → ${romname}`);
          }
          if (romurl && romurl !== table.romUrl) {
            table.romUrl = romurl;
            changeLog.push(`Table ${table.table}: ROM URL ${table.romUrl} → ${romurl}`);
          }
          if (mode && mode !== table.mode) {
            table.mode = mode;
            changeLog.push(`Table ${table.table}: Mode ${table.mode} → ${mode}`);
          }

          if (changeLog.some(log => log.includes(`Table ${table.table}`))) {
            updates.tables = tournament.tables;
          }
        }

        if (Object.keys(updates).length === 0) {
          return interaction.reply({
            content: `✅ Tournament **${tournament.name}** tables synchronized.`,
            flags: 64,
          });
        }

        await updateOne(
          { _id: tournament._id },
          { $set: updates },
          null,
          "tournaments",
        );

        const embed = new EmbedBuilder()
          .setColor("Green")
          .setTitle(`✅ Tournament Updated: ${tournament.name}`)
          .setDescription(changeLog.join("\n"));

        return interaction.reply({
          embeds: [embed],
          flags: 64,
        });
      } else {
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
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to execute edit-tournament command:");
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
