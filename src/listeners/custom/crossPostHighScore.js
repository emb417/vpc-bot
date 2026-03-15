import { Listener } from "@sapphire/framework";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { saveHighScore } from "../../commands/highscores/post-high-score.js";
import { searchScoreByVpsIdUsernameScorePipeline } from "../../lib/data/pipelines.js";
import {
  fetchHighScoresImage,
  buildHighScoresPage,
} from "../../lib/output/highScoreEmbed.js";
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

        const topScores = [...allScores]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);

        const isInTopTen = topScores.some(
          (s) =>
            (s.user?.id === user.id || s.username === highScoreData.u) &&
            s.score === highScoreData.s,
        );

        if (isInTopTen) {
          const isNewTopScore = topScores[0].score === highScoreData.s;
          const title = isNewTopScore
            ? "🥇 GRAND CHAMPION"
            : "🏆 NEW HIGH SCORE";
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

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("show_high_score_rules")
              .setLabel("Show Rules")
              .setStyle(ButtonStyle.Primary),
          );

          const message = await channel.send({
            content: `${user}`,
            embeds: [embed],
            components: [row],
            files: [{ attachment: attachmentBuffer, name: "score.png" }],
            allowedMentions: { users: [user.id] },
          });

          const highScoreId = allScores
            .find(
              (s) =>
                (s.user?.id === user.id || s.username === highScoreData.u) &&
                s.score === highScoreData.s,
            )
            ?._id?.toString();

          if (highScoreId) {
            highScoreData.scoreId = highScoreId;
            await updateHighScore(highScoreData, message.url);
          }

          // Post leaderboard image
          const imageBuffer = await fetchHighScoresImage(highScoreData.vpsId);
          const { embed: leaderboardEmbed, attachment } = buildHighScoresPage(
            { vpsId: highScoreData.vpsId },
            imageBuffer,
          );
          await channel.send({
            embeds: [leaderboardEmbed],
            files: [attachment],
          });
        }
      }
    } catch (e) {
      logger.error({ err: e }, "Error in crossPostHighScore");
    }
  }
}
