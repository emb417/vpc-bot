import "dotenv/config";
import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import logger from "../../utils/logger.js";
import { formatDateTime, formatNumber } from "../../utils/formatting.js";
import { searchScorePipeline } from "../../lib/data/pipelines.js";
import {
  aggregate,
  findOneAndUpdate,
  generateObjectId,
} from "../../services/database.js";
import { processImage } from "../../utils/image-processor.js";
import { findTable, findTablesByName } from "../../lib/data/tables.js";
import {
  fetchHighScoresImage,
  buildHighScoresPage,
} from "../../lib/output/highScoreEmbed.js";

global.pendingAttachments = global.pendingAttachments ?? new Map();
export const pendingAttachments = global.pendingAttachments;

export class PostHighScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "post-high-score",
      description: "Post a high score.",
      preconditions: ["HighScoresChannel"],
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
              .setName("score")
              .setDescription("Your score")
              .setRequired(true),
          )
          .addAttachmentOption((option) =>
            option
              .setName("image")
              .setDescription(
                "Screenshot of your high score and full playfield",
              )
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("table")
              .setDescription("Table name, VPS ID, or URL")
              .setRequired(true),
          ),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    const score = interaction.options.getString("score") ?? "<score>";
    const tableInput = interaction.options.getString("table");
    const attachment = interaction.options.getAttachment("image");

    const scoreValue = parseInt(score.replace(/,/g, ""));
    const re = /^([1-9]|[1-9][0-9]{1,14})$/;
    if (isNaN(scoreValue) || !re.test(String(scoreValue))) {
      return interaction.reply({
        content:
          "The score needs to be a number between 1 and 999999999999999.",
        flags: 64,
      });
    }

    const isUrl = /^https?:\/\//i.test(tableInput);

    // --- Direct path: URL or VPS ID ---
    if (isUrl || !tableInput.includes(" ")) {
      await interaction.deferReply({ flags: 64 });

      const { table, error: tableError } = await findTable(
        isUrl ? { url: tableInput } : { vpsId: tableInput },
      );

      if (table && !tableError) {
        try {
          const { existingScore, existingUserId } = await resolveExistingTopScore(
            table.vpsId,
            table.metadata.versionNumber,
          );

          let existingUser = null;
          if (existingUserId) {
            existingUser =
              await this.container.client.users.fetch(existingUserId);
          }

          const isNewTopScore = !existingScore || scoreValue > existingScore;

          await saveHighScore(
            {
              tableName: table.name,
              authorName: table.metadata.authorName,
              vpsId: table.vpsId,
              v: table.metadata.versionNumber,
              s: scoreValue,
            },
            interaction.user,
          );

          logger.info(
            `${interaction.user.username} posted high score: ${scoreValue} for ${table.name}`,
          );

          await postHighScoreEmbed({
            channel: interaction.channel,
            user: interaction.user,
            table,
            scoreValue,
            isNewTopScore,
            attachmentUrl: attachment?.url ?? null,
            existingUser,
          });

          await interaction.editReply({ content: "✅ High score posted!" });
          return;
        } catch (e) {
          logger.error({ err: e }, "Failed to post high score");
          await interaction.editReply({
            content: "An error occurred while saving your high score.",
          });
          return;
        }
      }

      // If it was a URL and failed, or a potential VPS ID that didn't match,
      // we fall through to search if it's not a URL. If it is a URL and failed, we should stop.
      if (isUrl) {
        return interaction.editReply({
          content: tableError ?? "Table not found via URL. Please try a search term.",
          flags: 64,
        });
      }
    }

    // --- Search term path ---
    if (attachment?.url) {
      pendingAttachments.set(interaction.user.id, attachment.url);
    }

    // Defer if not already deferred (it might have been deferred in the VPS ID check)
    if (!interaction.deferred) {
      await interaction.deferReply({ flags: 64 });
    }

    try {
      const { tables, error: searchError } =
        await findTablesByName(tableInput);

      if (searchError) {
        return interaction.editReply({ content: searchError });
      }

      if (tables.length > 0) {
        const options = tables.map((table) => {
          const firstAuthor = table.authorName.split(", ")[0];
          return {
            label: `${table.name} (${firstAuthor}... ${table.versionNumber})`,
            value: JSON.stringify({
              vpsId: table.vpsId,
              v: table.versionNumber,
              s: scoreValue,
            }),
          };
        });

        return interaction.editReply({
          content: "Which table do you want to post this high score?",
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("select")
                .setPlaceholder("Please select table for high score...")
                .addOptions(options),
            ),
          ],
        });
      } else {
        return interaction.editReply({
          content: `No tables were found in VPS data matching "${tableInput}". Try a different search term.`,
        });
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to find tables");
      return interaction.editReply({ content: e.message });
    }
  }
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared helpers — used by the command (direct path) and the listener
// ---------------------------------------------------------------------------

/**
 * Looks up the current top score for a given vpsId + version.
 * Returns the score value and userId so the caller can detect a new grand champion.
 */
export const resolveExistingTopScore = async (vpsId, versionNumber) => {
  const scorePipeline = searchScorePipeline(vpsId, versionNumber);
  const scoreResults = await aggregate(scorePipeline, "tables");
  const scoreData = scoreResults[0];
  return {
    existingScore: scoreData?.score ?? null,
    existingUserId: scoreData?.user?.id ?? null,
  };
};

/**
 * Builds and sends the high score embed + leaderboard, and DMs the displaced
 * top scorer if applicable. Used by both the direct path (command) and the
 * select-menu path (listener).
 */
export const postHighScoreEmbed = async ({
  channel,
  user,
  table,
  scoreValue,
  isNewTopScore,
  attachmentUrl,
  existingUser,
  messageUrl = null,
}) => {
  const firstAuthor = table.metadata.authorName.split(", ")[0];
  const title = isNewTopScore ? "🥇 GRAND CHAMPION" : "🏆 NEW HIGH SCORE";
  const description =
    `**User**: ${user.username}\n` +
    `**Table:** ${table.name} (${firstAuthor}... ${table.metadata.versionNumber})\n` +
    `**VPS Id:** ${table.vpsId}\n` +
    `**Score:** ${formatNumber(scoreValue)}\n` +
    `**Posted**: ${formatDateTime(new Date())}\n`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
    .setColor("Green");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("show_high_score_rules")
      .setLabel("📜 Rules")
      .setStyle(ButtonStyle.Secondary),
  );

  if (attachmentUrl) {
    try {
      const response = await fetch(attachmentUrl);
      if (!response.ok)
        throw new Error(`Failed to fetch: ${response.statusText}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Process image (standardize to PNG, optimize size, dynamic filename)
      const { buffer: processedBuffer, filename: processedFilename } = await processImage(buffer);
      
      embed.setImage(`attachment://${processedFilename}`);
      await channel.send({
        embeds: [embed],
        components: [row],
        files: [{ attachment: processedBuffer, name: processedFilename }],
      });
    } catch (e) {
      logger.error(
        { err: e },
        `Failed to fetch attachment for high score embed: ${e?.message ?? String(e)}`,
      );
      await channel.send({ embeds: [embed], components: [row] });
    }
  } else {
    await channel.send({ embeds: [embed], components: [row] });
  }

  // Leaderboard
  const imageBuffer = await fetchHighScoresImage(table.vpsId);
  const { embed: leaderboardEmbed, attachment } = buildHighScoresPage(
    { vpsId: table.vpsId },
    imageBuffer,
  );
  await channel.send({ embeds: [leaderboardEmbed], files: [attachment] });

  // DM the displaced top scorer
  if (
    isNewTopScore &&
    existingUser &&
    existingUser.username !== user.username
  ) {
    const dmContent =
      `**${user.username}** just topped your high score for:\n` +
      `**${table.name} (${firstAuthor}... ${table.metadata.versionNumber})**\n` +
      `**Score:** ${formatNumber(scoreValue)}\n` +
      `**Posted:** ${formatDateTime(new Date())}\n\n` +
      (messageUrl ? `🔗 ${messageUrl}` : "");

    await existingUser.send(dmContent).catch(() => {
      logger.error(`high score beaten DM failed to ${existingUser.username}`);
    });
  }
};

export const saveHighScore = async (data, user) => {
  const userObj = user || data.user;
  const username = userObj?.username || data.username;
  const versionNumber = data.versionNumber || data.v;
  const scoreValue = data.score || data.s;

  return findOneAndUpdate(
    { tableName: data.tableName },
    {
      $push: {
        "authors.$[a].versions.$[v].scores": {
          _id: generateObjectId(),
          user: userObj,
          username: username,
          score: scoreValue,
          mode: data.mode,
          postUrl: data.postUrl ?? "",
          createdAt: formatDateTime(new Date()),
        },
      },
    },
    {
      returnDocument: "after",
      arrayFilters: [
        { "a.vpsId": data.vpsId },
        { "v.versionNumber": versionNumber },
      ],
    },
    "tables",
  );
};
