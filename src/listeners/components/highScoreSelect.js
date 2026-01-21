import { Listener } from "@sapphire/framework";
import { InteractionType } from "discord.js";
import logger from "../../utils/logging.js";
import { formatDateTime, formatNumber } from "../../utils/formatting.js";
import { searchScorePipeline } from "../../lib/data/pipelines.js";
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
      const pipeline = searchScorePipeline(selectedJson.vpsId, selectedJson.v);
      const tables = await aggregate(pipeline, "tables");

      if (tables.length === 0) {
        throw new Error("No matches found.");
      }

      if (tables.length > 1) {
        throw new Error("Multiple matches found.");
      }

      const data = tables[0];
      selectedJson.tableName = data.tableName;
      selectedJson.authorName = data.authorName;
      selectedJson.versionNumber = data.versionNumber;
      selectedJson.vpsId = data.vpsId;

      const newScore = selectedJson.s;
      const existingScore = data?.score;

      const authorsArray = selectedJson?.authorName?.split(", ");
      const firstAuthor = authorsArray?.shift();

      let existingUser = null;
      if (data?.user?.id) {
        existingUser = await this.container.client.users.fetch(data.user.id);
      }

      const isNewTopScore = !existingScore || newScore > existingScore;

      // Save the high score
      await saveHighScore(selectedJson, interaction);

      const user = this.container.client.users.cache.find(
        (u) => u.username === selectedJson.u,
      );

      const headerText = isNewTopScore
        ? "**NEW TOP HIGH SCORE POSTED:**"
        : "**NEW HIGH SCORE POSTED:**";

      await interaction.update({
        content:
          `${headerText}\n` +
          `**User**: <@${user.id}>\n` +
          `**Table:** ${selectedJson.tableName} (${firstAuthor}... ${selectedJson.versionNumber})\n` +
          `**VPS Id:** ${selectedJson.vpsId}\n` +
          `**Score:** ${formatNumber(selectedJson.s)}\n` +
          `**Posted**: ${formatDateTime(new Date())}\n`,
        components: [],
      });

      // Show high scores for the table
      const tableScores = await getScoresByVpsId(selectedJson.vpsId);
      const contentArray = printHighScoreTables(
        selectedJson.tableName,
        tableScores || [],
        10,
        5,
      );

      for (const post of contentArray) {
        await interaction.channel.send(post);
      }

      // DM previous high score holder if someone beat their score
      if (
        isNewTopScore &&
        existingUser &&
        existingUser.username !== user.username
      ) {
        const content =
          `**@${user?.username}** just topped your high score for:\n` +
          `**${selectedJson?.tableName} (${firstAuthor}... ${selectedJson?.versionNumber})**\n` +
          `**Score:** ${formatNumber(selectedJson?.s)}\n` +
          `**Posted**: ${formatDateTime(new Date())}\n\n` +
          `Link: ${interaction?.message?.url}`;

        logger.info("Sending DM to previous High Score holder.");
        await existingUser.send(content).catch(() => {
          logger.info("Could not send DM to previous High Score holder.");
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
