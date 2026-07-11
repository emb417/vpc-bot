import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { formatNumber } from "../../utils/formatting.js";
import {
  TOURNAMENT_POINTS_BY_RANK,
  assignPoints,
} from "../../lib/scores/points.js";
import { findActiveTournament, updateOne } from "../../services/database.js";

export const removeTournamentScore = async (
  channelName,
  tableIndex,
  username,
) => {
  const tournament = await findActiveTournament(channelName);
  if (!tournament) {
    throw new Error("No active tournament found for this channel.");
  }

  const tableEntry = (tournament.tables ?? []).find(
    (t) => String(t.tableIndex) === String(tableIndex),
  );
  if (!tableEntry) {
    throw new Error("That table was not found in this tournament.");
  }

  const scores = tableEntry.scores ?? [];
  const scoreToRemove = scores.find(
    (s) => s.username?.toLowerCase() === username.toLowerCase(),
  );

  if (!scoreToRemove) {
    return null;
  }

  const updatedScores = scores.filter(
    (s) => s.username?.toLowerCase() !== username.toLowerCase(),
  );
  updatedScores.sort((a, b) => b.score - a.score);
  assignPoints(updatedScores, TOURNAMENT_POINTS_BY_RANK);

  await updateOne(
    { channelName: channelName, status: "active" },
    { $set: { "tables.$[t].scores": updatedScores } },
    { arrayFilters: [{ "t.tableIndex": tableEntry.tableIndex }] },
    "tournaments",
  );

  return {
    score: scoreToRemove,
    vpsId: tableEntry.vpsId,
    tableName: tableEntry.table,
  };
};

export class RemoveTournamentScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "remove-tournament-score",
      description:
        "Remove a player's score from a table in the active tournament.",
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
              .setDescription("Which table to remove the score from")
              .setRequired(true)
              .setAutocomplete(true),
          )
          .addStringOption((option) =>
            option
              .setName("username")
              .setDescription("Username of the player")
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

    try {
      const result = await removeTournamentScore(
        channel.name,
        tableIndex,
        username,
      );

      if (!result) {
        return interaction.reply({
          content: `No score found for ${username} on ${channel.name}.`,
          flags: 64,
        });
      }

      return interaction.reply({
        content:
          `Score removed. ${result.score.username}'s score of ` +
          `${formatNumber(result.score.score)} on ${result.tableName} has been removed.`,
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to remove tournament score:");
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
