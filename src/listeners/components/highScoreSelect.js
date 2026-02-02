import { Listener } from "@sapphire/framework";
import { InteractionType } from "discord.js";
import logger from "../../utils/logger.js";
import { formatDateTime, formatNumber } from "../../utils/formatting.js";
import {
  searchTableByVpsIdPipeline,
  searchScorePipeline,
} from "../../lib/data/pipelines.js";
import { printHighScoreTables } from "../../lib/output/tables.js";
import { getScoresByVpsId } from "../../lib/data/vpc.js";
import { aggregate } from "../../services/database.js";
import { saveHighScore } from "../../commands/highscores/post-high-score.js";

export class HighScoreSelectListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.type !== InteractionType.MessageComponent) return;
    if (interaction.customId !== "select") return;

    try {
      const selectedJson = JSON.parse(interaction.values[0]);

      // Parse the select menu value
      const vpsId = selectedJson.vpsId;
      const versionNumber = selectedJson.v;
      const newScore = selectedJson.s;

      // 1. Fetch table info (to get author + table name)
      const tablePipeline = searchTableByVpsIdPipeline(vpsId);
      const tableResults = await aggregate(tablePipeline, "tables");
      const table = tableResults[0];

      const authorName =
        table?.authors?.[0]?.authorName ??
        table?.authorName ??
        "Unknown Author";

      const tableName = table.tableName;

      // 2. Fetch score info (to get existing high score + previous user)
      const scorePipeline = searchScorePipeline(vpsId, versionNumber);
      const scoreResults = await aggregate(scorePipeline, "tables");
      const scoreData = scoreResults[0];

      const existingScore = scoreData?.score;
      const existingUserId = scoreData?.user?.id ?? null;

      // 3. Prepare selectedJson for saveHighScore
      selectedJson.tableName = tableName;
      selectedJson.authorName = authorName;
      selectedJson.v = versionNumber;
      selectedJson.vpsId = vpsId;

      const authorsArray = authorName.split(", ");
      const firstAuthor = authorsArray.shift();

      let existingUser = null;
      if (existingUserId) {
        existingUser = await this.container.client.users.fetch(existingUserId);
      }

      const isNewTopScore = !existingScore || newScore > existingScore;

      // Save the high score
      await saveHighScore(selectedJson, interaction.user);

      const user = interaction.user;
      logger.info(
        `${user.username} posted high score: ${selectedJson.s} for ${selectedJson.tableName}`,
      );

      const headerText = isNewTopScore
        ? "**NEW TOP HIGH SCORE POSTED:**"
        : "**NEW HIGH SCORE POSTED:**";

      await interaction.update({
        content:
          `${headerText}\n` +
          `**User**: <@${user.id}>\n` +
          `**Table:** ${selectedJson.tableName} (${firstAuthor}... ${selectedJson.v})\n` +
          `**VPS Id:** ${selectedJson.vpsId}\n` +
          `**Score:** ${formatNumber(selectedJson.s)}\n` +
          `**Posted**: ${formatDateTime(new Date())}\n`,
        components: [],
      });

      // Show high scores for the table
      const tables = await getScoresByVpsId(selectedJson.vpsId);

      const contentArray = printHighScoreTables(
        selectedJson.tableName,
        tables || [],
        10,
        2,
      );

      // If you only expect embeds here:
      for (const embed of contentArray) {
        await interaction.channel.send({ embeds: [embed] });
      }

      // DM previous high score holder if someone beat their score
      if (
        isNewTopScore &&
        existingUser &&
        existingUser.username !== user.username
      ) {
        const content =
          `**@${user?.username}** just topped your high score for:\n` +
          `**${selectedJson?.tableName} (${firstAuthor}... ${selectedJson?.v})**\n` +
          `**Score:** ${formatNumber(selectedJson?.s)}\n` +
          `**Posted:** ${formatDateTime(new Date())}\n\n` +
          `Link: ${interaction?.message?.url}`;

        // Compact one-line log
        logger.info(
          `high score beaten DM sent to ${user?.username}: ${selectedJson?.s} for ${selectedJson?.tableName}`,
        );

        await existingUser.send(content).catch(() => {
          logger.error(`high score beaten DM failed to ${user?.username}`);
        });
      }
    } catch (e) {
      logger.error(e);
      if (!interaction.replied) {
        await interaction.reply({
          content: e.message,
          components: [],
          flags: 64,
        });
      } else {
        await interaction.followUp({
          content: e.message,
          components: [],
          flags: 64,
        });
      }
    }
  }
}
