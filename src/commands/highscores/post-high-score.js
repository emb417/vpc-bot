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
      aliases: ["high"],
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
              .setName("tablesearchterm")
              .setDescription("Search term for table")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("vpsid")
              .setDescription("VPS ID of the table")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("url")
              .setDescription("URL of the table")
              .setRequired(false),
          ),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    const score = interaction.options.getString("score") ?? "<score>";
    const tableSearchTerm = interaction.options.getString("tablesearchterm");
    const vpsId = interaction.options.getString("vpsid");
    const url = interaction.options.getString("url");
    const attachment = interaction.options.getAttachment("image");

    if (!tableSearchTerm && !vpsId && !url) {
      return interaction.reply({
        content:
          "You must provide at least one of: `tablesearchterm`, `vpsid`, or `url`.",
        flags: 64,
      });
    }

    const scoreValue = parseInt(score.replace(/,/g, ""));
    const re = /^([1-9]|[1-9][0-9]{1,14})$/;
    if (isNaN(scoreValue) || !re.test(String(scoreValue))) {
      return interaction.reply({
        content:
          "The score needs to be a number between 1 and 999999999999999.",
        flags: 64,
      });
    }

    // --- Direct path: vpsid or url — resolve, save, and post inline, no select menu ---
    if (vpsId || url) {
      await interaction.deferReply({ flags: 64 });

      const { table, error: tableError } = await findTable({ vpsId, url });

      if (tableError || !table) {
        return interaction.editReply({
          content:
            (tableError ?? "Table not found in VPS data.") +
            " Please try again using `tablesearchterm` instead.",
          flags: 64,
        });
      }

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
      } catch (e) {
        logger.error({ err: e }, "Failed to post high score");
        await interaction.editReply({
          content: "An error occurred while saving your high score.",
        });
      }

      return;
    }

    // --- Search term path: search VPS, upsert matches, show select menu ---
    if (attachment?.url) {
      pendingAttachments.set(interaction.user.id, attachment.url);
    }

    // Defer immediately — VPS search + upserts can exceed Discord's 3s interaction timeout
    await interaction.deferReply({ flags: 64 });

    try {
      const { tables, error: searchError } =
        await findTablesByName(tableSearchTerm);

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
          content: `No tables were found in VPS data matching "${tableSearchTerm}". Try a different search term.`,
        });
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to find tables");
      return interaction.editReply({ content: e.message });
    }
  }

  async messageRun(message, args) {
    const score = await args.pick("string").catch(() => null);
    const tableSearchTerm = await args.rest("string").catch(() => null);

    if (!score || !tableSearchTerm) {
      return message.reply({
        content: "Please provide a score and table search term.",
      });
    }

    const scoreValue = parseInt(score.replace(/,/g, ""));
    const re = /^([1-9]|[1-9][0-9]{1,14})$/;
    if (isNaN(scoreValue) || !re.test(String(scoreValue))) {
      const reply = await message.reply({
        content:
          "The score needs to be a number between 1 and 999999999999999.",
      });
      await message.delete().catch(() => {});
      setTimeout(() => reply.delete().catch(() => {}), 10000);
      return;
    }

    const attachment = message.attachments?.first();
    if (!attachment) {
      const reply = await message.reply({
        content:
          "No photo attached. Please attach a photo with your high score.\n" +
          `\`!high ${scoreValue} ${tableSearchTerm}\`\n` +
          "This message will be deleted in 10 seconds.",
      });
      await message.delete().catch(() => {});
      setTimeout(() => reply.delete().catch(() => {}), 10000);
      return;
    }

    try {
      const { tables, error: searchError } =
        await findTablesByName(tableSearchTerm);

      if (searchError) {
        const reply = await message.reply({ content: searchError });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
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

        await message.reply({
          content: "Which table do you want to post this high score?",
          files: [attachment],
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("select")
                .setPlaceholder("Please select table for high score...")
                .addOptions(options),
            ),
          ],
        });
        await message.delete().catch(() => {});
      } else {
        const reply = await message.reply({
          content: `No tables were found in VPS data matching "${tableSearchTerm}". Try a different search term.`,
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to find tables");
      message.reply({ content: e.message });
    }
  }
}

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
      .setLabel("Show Rules")
      .setStyle(ButtonStyle.Primary),
  );

  if (attachmentUrl) {
    try {
      const response = await fetch(attachmentUrl);
      if (!response.ok)
        throw new Error(`Failed to fetch: ${response.statusText}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      embed.setImage("attachment://score.png");
      await channel.send({
        embeds: [embed],
        components: [row],
        files: [{ attachment: buffer, name: "score.png" }],
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
