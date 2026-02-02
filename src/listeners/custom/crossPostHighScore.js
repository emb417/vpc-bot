import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { formatDateTime, formatNumber } from "../../utils/formatting.js";
import { printHighScoreTables } from "../../lib/output/tables.js";
import { getScoresByVpsId } from "../../lib/data/vpc.js";
import {
  highScoreExists,
  saveHighScore,
  updateHighScore,
} from "../../commands/highscores/post-high-score.js";

export class CrossPostHighScoreListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "crossPostHighScore",
      emitter: context.client,
    });
  }

  async run(data) {
    const {
      user,
      score,
      attachment,
      currentWeek,
      channelId,
      postSubscript,
      doPost,
    } = data;

    const channel = this.container.client.channels.cache.get(channelId);
    if (!channel) {
      logger.error(`Channel ${channelId} not found for cross-post`);
      return;
    }

    const highScoreData = {
      tableName: currentWeek.table,
      authorName: currentWeek.authorName,
      versionNumber: currentWeek.versionNumber,
      vpsId: currentWeek.vpsId,
      mode: currentWeek.mode,
      u: user.username,
      s: score,
    };

    try {
      const exists = await highScoreExists(highScoreData);

      if (!exists) {
        const newHighScore = await saveHighScore(highScoreData, user);

        // Get the score ID from the saved document
        const highScoreId = newHighScore?.authors
          ?.find((a) => a.vpsId === highScoreData.vpsId)
          ?.versions?.find(
            (v) => v.versionNumber === highScoreData.versionNumber,
          )
          ?.scores?.reduce((a, b) => (a.score > b.score ? a : b))
          ?._id?.toString();

        if (doPost) {
          const mode = highScoreData.mode ?? "default";
          const message = await channel.send({
            content:
              `**NEW HIGH SCORE POSTED:**\n` +
              `**User**: <@${user.id}>\n` +
              `**Table:** ${highScoreData.tableName}\n` +
              (mode !== "default" ? `**Mode:** ${mode}\n` : "") +
              `**VPS Id:** ${highScoreData.vpsId}\n` +
              `**Score:** ${formatNumber(highScoreData.s)}\n` +
              `**Posted**: ${formatDateTime(new Date())}\n` +
              `*${postSubscript}*`,
            files: [attachment],
          });

          // Update the high score with the post URL
          if (highScoreId) {
            highScoreData.scoreId = highScoreId;
            await updateHighScore(highScoreData, message.url);
          }

          // Show table high scores
          const tableScores = await getScoresByVpsId(highScoreData.vpsId);
          const contentArray = printHighScoreTables(
            highScoreData.tableName,
            tableScores || [],
            10,
            2,
          );

          if (!Array.isArray(contentArray) || contentArray.length === 0) {
            await channel.send("No results found for that VPS ID or table.");
            return;
          }

          for (const post of contentArray) {
            if (typeof post === "string") {
              await channel.send({ content: post });
            } else {
              // assume post is an embed-like object
              await channel.send({ embeds: [post] });
            }
          }
        }
      }
    } catch (e) {
      logger.error("Error in crossPostHighScore:", e);
    }
  }
}
