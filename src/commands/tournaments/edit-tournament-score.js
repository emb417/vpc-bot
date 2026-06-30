import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { formatNumber } from "../../utils/formatting.js";
import { processScore } from "../../lib/scores/scoring.js";
import { TOURNAMENT_POINTS_BY_RANK } from "../../lib/scores/points.js";
import { findActiveTournament, updateOne } from "../../services/database.js";

export class EditTournamentScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "edit-tournament-score",
      description: "Edit a player's score for a table in the active tournament.",
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
              .setDescription("Which table this score is for")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("username")
              .setDescription("Username of the player")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("score")
              .setDescription("New score")
              .setRequired(true),
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
    const username = interaction.options.getString("username");
    const score = interaction.options.getString("score");

    try {
      const tournament = await findActiveTournament(channel.name);
      if (!tournament) {
        return interaction.reply({
          content: "No active tournament found for this channel.",
          flags: 64,
        });
      }

      const tableEntry = (tournament.tables ?? []).find(
        (t) => String(t.tableIndex) === String(tableIndex),
      );
      if (!tableEntry) {
        return interaction.reply({
          content: "That table was not found in this tournament.",
          flags: 64,
        });
      }

      // Find the user or create a mock user object
      const user = this.container.client.users.cache.find(
        (u) => u.username === username,
      ) || {
        username: username,
        id: "manual-edit",
        displayAvatarURL: () => "",
      };

      // Process the score with F1-style tournament points
      const result = processScore(user, score, tableEntry, {
        pointsTable: TOURNAMENT_POINTS_BY_RANK,
      });

      // Persist the updated scores for this table only
      await updateOne(
        { channelName: channel.name, status: "active" },
        { $set: { "tables.$[t].scores": result.scores } },
        { arrayFilters: [{ "t.tableIndex": tableEntry.tableIndex }] },
        "tournaments",
      );

      const retVal =
        "**TOURNAMENT SCORE EDITED:**\n" +
        `**User:** ${username}\n` +
        `**Tournament:** ${tournament.name}\n` +
        `**Table:** ${tableEntry.table}\n` +
        `**Score:** ${formatNumber(result.scoreAsInt)} (${result.scoreDiff >= 0 ? "+" : ""}${formatNumber(result.scoreDiff)})\n` +
        `**Table Rank:** ${result.currentRank} (${result.rankChange >= 0 ? "+" + result.rankChange : result.rankChange})`;

      return interaction.reply({
        content: retVal,
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to edit tournament score:");
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
