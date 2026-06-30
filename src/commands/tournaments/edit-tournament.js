import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { findActiveTournament, updateOne } from "../../services/database.js";

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
      ? await findActiveTournament(channelName)
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
    const channel = interaction.channel;
    const tableIndex = interaction.options.getString("table");
    const romName = interaction.options.getString("romname");
    const romUrl = interaction.options.getString("romurl");
    const mode = interaction.options.getString("mode");
    const startDate = interaction.options.getString("startdate");
    const endDate = interaction.options.getString("enddate");
    const notes = interaction.options.getString("notes");

    try {
      if (
        romName == null &&
        romUrl == null &&
        mode == null &&
        startDate == null &&
        endDate == null &&
        notes == null
      ) {
        return interaction.reply({
          content:
            "Nothing to update. Provide at least one of: romname, romurl, mode, startdate, enddate, notes.",
          flags: 64,
        });
      }

      const tournament = await findActiveTournament(channel.name);
      if (!tournament) {
        return interaction.reply({
          content: "No active tournament found for this channel.",
          flags: 64,
        });
      }

      // ROM/mode edits are per-table and need a target table.
      let tableEntry = null;
      if (romName != null || romUrl != null || mode != null) {
        if (!tableIndex) {
          return interaction.reply({
            content:
              "Please choose a `table` to apply the ROM/mode change to.",
            flags: 64,
          });
        }
        tableEntry = (tournament.tables ?? []).find(
          (t) => String(t.tableIndex) === String(tableIndex),
        );
        if (!tableEntry) {
          return interaction.reply({
            content: "That table was not found in this tournament.",
            flags: 64,
          });
        }
      }

      // Validate dates and the resulting start <= end ordering.
      if (startDate != null && !isValidDate(startDate)) {
        return interaction.reply({
          content: "Invalid start date. Use YYYY-MM-DD.",
          flags: 64,
        });
      }
      if (endDate != null && !isValidDate(endDate)) {
        return interaction.reply({
          content: "Invalid end date. Use YYYY-MM-DD.",
          flags: 64,
        });
      }
      const effectiveStart = startDate ?? tournament.startDate;
      const effectiveEnd = endDate ?? tournament.endDate;
      if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
        return interaction.reply({
          content: `End date (${effectiveEnd}) cannot be before start date (${effectiveStart}).`,
          flags: 64,
        });
      }

      // Build the update document and a human-readable change list.
      const setDoc = {};
      const changes = [];

      if (startDate != null) {
        setDoc.startDate = startDate;
        changes.push(`**Start Date:** ${tournament.startDate} → ${startDate}`);
      }
      if (endDate != null) {
        setDoc.endDate = endDate;
        changes.push(`**End Date:** ${tournament.endDate} → ${endDate}`);
      }
      if (notes != null) {
        setDoc.notes = notes;
        changes.push(
          tournament.notes
            ? `**Notes:** updated`
            : `**Notes:** added`,
        );
      }
      if (tableEntry) {
        if (romName != null) {
          setDoc["tables.$[t].romName"] = romName;
          changes.push(
            `**ROM Name** (${tableEntry.table}): ${tableEntry.romName} → ${romName}`,
          );
        }
        if (romUrl != null) {
          setDoc["tables.$[t].romUrl"] = romUrl;
          changes.push(
            `**ROM URL** (${tableEntry.table}): ${tableEntry.romUrl} → ${romUrl}`,
          );
        }
        if (mode != null) {
          setDoc["tables.$[t].mode"] = mode;
          changes.push(
            `**Mode** (${tableEntry.table}): ${tableEntry.mode} → ${mode}`,
          );
        }
      }

      const options = tableEntry
        ? { arrayFilters: [{ "t.tableIndex": tableEntry.tableIndex }] }
        : null;

      await updateOne(
        { channelName: channel.name, status: "active" },
        { $set: setDoc },
        options,
        "tournaments",
      );

      // Announce the changes in the tournament channel.
      const embed = new EmbedBuilder()
        .setTitle(`✏️ Updated Tournament: ${tournament.name}`)
        .setDescription(changes.join("\n"))
        .setColor("Blue");

      if (notes != null) {
        embed.addFields({ name: "Notes", value: notes.slice(0, 1024) });
      }

      await channel.send({ embeds: [embed] });

      return interaction.reply({
        content: "✅ Tournament updated.",
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to edit tournament:");
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
