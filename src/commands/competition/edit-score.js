import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { formatNumber } from "../../utils/formatting.js";
import { processScore } from "../../lib/scores/scoring.js";
import { editWeeklyCompetitionCornerMessage } from "../../lib/output/messages.js";
import { findCurrentWeek, updateOne } from "../../services/database.js";

export class EditScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "edit-score",
      description: "Edit current competition score.",
      preconditions: ["CompetitionChannel", "CompetitionAdminRole"],
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
              .setName("username")
              .setDescription("Username of the player")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option.setName("score").setDescription("New score").setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;
    const username = interaction.options.getString("username");
    const score = interaction.options.getString("score");

    try {
      const currentWeek = await findCurrentWeek(channel.name);

      if (!currentWeek) {
        return interaction.reply({
          content: "No active week found for this channel.",
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

      // Process the score
      const result = processScore(user, score, currentWeek);

      // Save to database
      await updateOne(
        { channelName: channel.name, isArchived: false },
        { $set: { scores: result.scores } },
        null,
        "weeks",
      );

      // Update pinned message if in competition channel
      if (channel.name === process.env.COMPETITION_CHANNEL_NAME) {
        await editWeeklyCompetitionCornerMessage(
          result.scores,
          this.container.client,
          currentWeek,
          currentWeek.teams,
        );
      }

      // Format response
      const retVal =
        "**SCORE EDITED:**\n" +
        `**User:** ${username}\n` +
        `**Table:** ${currentWeek.table}\n` +
        (result.mode !== "default" ? `**Mode:** ${result.mode}\n` : "") +
        `**Score:** ${formatNumber(result.scoreAsInt)} (${result.scoreDiff >= 0 ? "+" : ""} ${formatNumber(result.scoreDiff)})\n` +
        `**Rank:** ${result.currentRank} (${result.rankChange >= 0 ? "+" + result.rankChange : result.rankChange})`;

      return interaction.reply({
        content: retVal,
        flags: 64,
      });
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
