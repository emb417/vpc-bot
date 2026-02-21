import { Listener } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import { saveHighScore } from "../../commands/highscores/post-high-score.js";
import { searchScoreByVpsIdUsernameScorePipeline } from "../../lib/data/pipelines.js";
import { getScoresByVpsId } from "../../lib/data/vpc.js";
import { printHighScoreTables } from "../../lib/output/tables.js";
import { aggregate, findOneAndUpdate } from "../../services/database.js";
import { formatDateTime, formatNumber } from "../../utils/formatting.js";

import logger from "../../utils/logger.js";

export const highScoreExists = async (data) => {
  const pipeline = searchScoreByVpsIdUsernameScorePipeline({
    vpsId: data.vpsId,
    u: data.u || data.username,
    s: data.s || data.score,
  });
  const tables = await aggregate(pipeline, "tables");
  return tables.length > 0;
};

export const updateHighScore = async (data, postUrl) => {
  const { ObjectId } = await import("mongodb");
  return findOneAndUpdate(
    { tableName: data.tableName },
    { $set: { "authors.$[a].versions.$[v].scores.$[s].postUrl": postUrl } },
    {
      returnDocument: "after",
      arrayFilters: [
        { "a.vpsId": data.vpsId },
        { "v.versionNumber": data.versionNumber },
        { "s._id": new ObjectId(data.scoreId) },
      ],
    },
    "tables",
  );
};

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
      attachmentBuffer,
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

        const allScores =
          newHighScore?.authors
            ?.find((a) => a.vpsId === highScoreData.vpsId)
            ?.versions?.find(
              (v) => v.versionNumber === highScoreData.versionNumber,
            )?.scores ?? [];

        const topScore = allScores.reduce(
          (a, b) => (a.score > b.score ? a : b),
          { score: 0 },
        );
        const isNewTopScore = topScore.score === score;

        const title = isNewTopScore ? "🥇 PERSONAL BEST" : "🏆 NEW HIGH SCORE";

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

          const description =
            `**User**: ${user.username}\n` +
            `**Table:** ${highScoreData.tableName}\n` +
            (mode !== "default" ? `**Mode:** ${mode}\n` : "") +
            `**VPS Id:** ${highScoreData.vpsId}\n` +
            `**Score:** ${formatNumber(highScoreData.s)}\n` +
            `**Posted**: ${formatDateTime(new Date())}\n` +
            `*${postSubscript}*`;

          const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setImage("attachment://score.png")
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
            .setColor("Green");

          const message = await channel.send({
            content: `${user}`,
            embeds: [embed],
            files: [{ attachment: attachmentBuffer, name: "score.png" }],
            allowedMentions: {
              users: [user.id],
            },
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
