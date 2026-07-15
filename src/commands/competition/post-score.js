import "dotenv/config";
import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import logger from "../../utils/logger.js";
import { processImage } from "../../utils/image-processor.js";
import { formatNumber } from "../../utils/formatting.js";
import {
  isEntryQualified,
  loadApprovedTables,
  notifyQualificationChange,
} from "../../lib/raffle/raffle.js";
import { processScore, validateScore } from "../../lib/scores/scoring.js";
import { editWeeklyCompetitionCornerMessage } from "../../lib/output/messages.js";
import {
  find,
  findCurrentWeek,
  findCurrentPlayoff,
  findOne,
  updateOne,
  updateMany,
} from "../../services/database.js";

export class PostScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "post-score",
      description: "Post score for a competition channel.",
      preconditions: ["CompetitionChannel"],
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
              .setDescription("Screenshot of full playfield and score")
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const score = interaction.options.getString("score") ?? "<score>";
    const postToHighScore = interaction.options.getString(
      "posttohighscorechannel",
    );
    const attachment = interaction.options.getAttachment("image");

    await interaction.reply({
      content: "Posting score...",
      flags: 64,
    });

    try {
      await this.handleScore(
        interaction,
        score,
        postToHighScore,
        attachment,
      );

      return interaction.editReply({
        content: "✅ Score posted successfully.",
      });
    } catch (e) {
      logger.error({ err: e }, "Error in PostScoreCommand.chatInputRun:");
      return interaction.editReply({
        content: `❌ ${e.message}`,
      });
    }
  }

  async handleScore(interaction, score, postToHighScoreChannel, attachment) {
    const channel = interaction.channel;
    const user = interaction.user;
    const reHighScoreCheck = /Rank:\*\* [1|2|3|4|5|6|7|8|9|10] of/;

    try {
      // Validate score
      const validation = validateScore(score);
      if (!validation.valid) {
        throw new Error(`${validation.error}`);
      }

      let attachmentBuffer, attachmentName;
      try {
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        attachmentBuffer = Buffer.from(await response.arrayBuffer());
        attachmentName = attachment.name;
      } catch (fetchError) {
        logger.error({ err: fetchError }, "Failed to download attachment:");
        throw new Error("Failed to process image. Please try again.");
      }

      // Process image (standardize to PNG, optimize size, dynamic filename)
      const { buffer: processedBuffer, filename: processedFilename } = await processImage(attachmentBuffer);

      // Get current week
      const currentWeek = await findCurrentWeek(channel.name);

      if (!currentWeek) {
        throw new Error("No active week found for this channel.");
      }

      // Process the score
      const result = processScore(user, validation.value, currentWeek);

      // Asynchronously update historical avatars if changed
      this.updateHistoricalAvatars(user).catch((e) =>
        logger.error({ err: e }, "Error updating historical avatars:"),
      );

      // Pre-score raffle qualification state
      const weekId = currentWeek._id.toString();
      const userRaffleEntry = await findOne(
        { weekId, userId: user.id },
        "raffles",
      );
      let wasQualified = null;
      let approvedTables = null;
      let weekEntries = null;

      if (userRaffleEntry) {
        approvedTables = await loadApprovedTables();
        weekEntries = await find({ weekId }, "raffles");
        wasQualified = isEntryQualified(
          userRaffleEntry.table.vpsId,
          weekEntries,
          currentWeek.scores ?? [],
          approvedTables,
        );
      }

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

      logger.info(
        `${user.username} posted weekly score: ${result.scoreAsInt} for ${currentWeek.table} ranked ${result.currentRank}`,
      );

      // Build embed
      const description =
        `**User:** ${user.username}\n` +
        `**Table:** ${currentWeek.table}\n` +
        (result.mode !== "default" ? `**Mode:** ${result.mode}\n` : "") +
        `**Score:** ${formatNumber(result.scoreAsInt)} (${result.scoreDiff >= 0 ? "+" : ""}${formatNumber(result.scoreDiff)})\n`;

      const title = result.currentRank.startsWith("1 of")
        ? "🥇  NEW TOP SCORE"
        : "🏆  NEW SCORE";

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .addFields({
          name: "Rank",
          value: `${result.currentRank} (${result.rankChange >= 0 ? "+" + result.rankChange : result.rankChange})`,
          inline: true,
        })
        .setImage(`attachment://${processedFilename}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setColor("Green");

      // Used for cross-post check — mirrors what was previously in retVal
      const retVal = `**Rank:** ${result.currentRank} (${result.rankChange >= 0 ? "+" + result.rankChange : result.rankChange})`;

      // Build action row with buttons
      const showPlayoffButton = await findCurrentPlayoff(channel.name);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("showLeaderboard")
          .setLabel("📋 Leaderboard")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("show_competition_rules")
          .setLabel("📜 Rules")
          .setStyle(ButtonStyle.Secondary),
      );

      if (showPlayoffButton) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("showPlayoffs")
            .setLabel("🏆 Playoffs")
            .setStyle(ButtonStyle.Secondary),
        );
      }

      // Reply with score embed
      await interaction.channel.send({
        embeds: [embed],
        files: [{ attachment: processedBuffer, name: processedFilename }],
        components: [row],
      });

      // Emit cross-post event
      const shouldPost =
        reHighScoreCheck.test(retVal) ||
        postToHighScoreChannel?.toLowerCase() === "y";

      this.container.client.emit("crossPostHighScore", {
        user,
        score: validation.value,
        attachmentBuffer: processedBuffer,
        attachmentName: processedFilename,
        currentWeek,
        channelId: process.env.HIGH_SCORES_CHANNEL_ID,
        postSubscript: `🔗 <#${channel.id}>`,
        doPost: shouldPost,
      });

      // Post-score raffle qualification check
      if (userRaffleEntry) {
        const nowQualified = isEntryQualified(
          userRaffleEntry.table.vpsId,
          weekEntries,
          result.scores,
          approvedTables,
        );

        notifyQualificationChange(
          this.container.client,
          process.env.COMPETITION_CHANNEL_ID,
          userRaffleEntry.table,
          weekEntries.filter(
            (e) => e.table.vpsId === userRaffleEntry.table.vpsId,
          ),
          wasQualified,
          nowQualified,
        ).catch((e) =>
          logger.error({ err: e }, "notifyQualificationChange error:"),
        );
      }
    } catch (e) {
      // Re-throw to be handled by chatInputRun
      throw e;
    }
  }

  async updateHistoricalAvatars(user) {
    const currentAvatarUrl = user.displayAvatarURL({
      dynamic: true,
      size: 128,
    });

    const lastWeek = await findOne(
      {
        scores: {
          $elemMatch: {
            $or: [{ userId: user.id }, { username: user.username }],
          },
        },
      },
      "weeks",
    );

    const storedAvatarUrl = lastWeek?.scores?.find(
      (s) => s.userId === user.id || s.username === user.username,
    )?.userAvatarUrl;

    if (currentAvatarUrl !== storedAvatarUrl) {
      await updateMany(
        {
          scores: {
            $elemMatch: {
              $or: [{ userId: user.id }, { username: user.username }],
            },
          },
        },
        { $set: { "scores.$[s].userAvatarUrl": currentAvatarUrl } },
        {
          arrayFilters: [
            { $or: [{ "s.userId": user.id }, { "s.username": user.username }] },
          ],
        },
        "weeks",
      );

      logger.info(`Updated historical avatars for ${user.username}`);
    }
  }
}
