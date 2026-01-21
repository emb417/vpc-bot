import "dotenv/config";
import { Command } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import logger from "../../utils/logging.js";
import { formatNumber } from "../../utils/formatting.js";
import { processScore, validateScore } from "../../lib/scores/scoring.js";
import { editWeeklyCompetitionCornerMessage } from "../../lib/output/messages.js";
import {
  findCurrentWeek,
  findCurrentPlayoff,
  updateOne,
} from "../../services/database.js";

export class PostScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "post-score",
      aliases: ["score"],
      description: "Post score for a competition channel.",
      preconditions: ["CompetitionChannel"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName("score")
            .setDescription("Your score")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("posttohighscorechannel")
            .setDescription("Post to high score channel (y/n)")
            .setRequired(false),
        ),
    );
  }

  async messageRun(message, args) {
    const score = await args.pick("string").catch(() => null);
    if (!score) {
      return message.reply({
        content: "Please provide a score.",
      });
    }

    const postToHighScore = await args.pick("string").catch(() => null);
    return this.handleScore(
      message,
      message.author,
      score,
      postToHighScore,
      true,
    );
  }

  async chatInputRun(interaction) {
    // Slash command is disabled - instruct to use message command
    return interaction.reply({
      content:
        "The post-score slash command has been turned off. Please use the following format to post your score:\n`!score 1234567 (an image is REQUIRED as an attachment)`",
      flags: 64,
    });
  }

  async handleScore(message, user, score, postToHighScoreChannel, isMessage) {
    const channel = message.channel;
    const reHighScoreCheck = /Rank:\*\* [1|2|3|4|5|6|7|8|9|10] of/;

    try {
      // Validate score
      const validation = validateScore(score);
      if (!validation.valid) {
        const reply = await message.reply({
          content: `${validation.error} This message will be deleted in 10 seconds.`,
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
      }

      // Check for attachment
      const attachment = message.attachments?.first();
      if (!attachment) {
        const reply = await message.reply({
          content:
            "No photo attached. Please attach a photo with your high score. This message will be deleted in 10 seconds.",
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
      }

      // Get current week
      const currentWeek = await findCurrentWeek(channel.name);
      if (!currentWeek) {
        return message.reply({
          content: "No active week found for this channel.",
        });
      }

      // Process the score
      const result = processScore(user, validation.value, currentWeek);

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
        "**NEW WEEKLY SCORE POSTED:**\n" +
        `**User:** <@${user.id}>\n` +
        `**Table:** ${currentWeek.table}\n` +
        (result.mode !== "default" ? `**Mode:** ${result.mode}\n` : "") +
        `**Score:** ${formatNumber(result.scoreAsInt)} (${result.scoreDiff >= 0 ? "+" : ""} ${formatNumber(result.scoreDiff)})\n` +
        `**Rank:** ${result.currentRank} (${result.rankChange >= 0 ? "+" + result.rankChange : result.rankChange})`;

      logger.info(retVal);

      // Build action row with buttons
      const showPlayoffButton = await findCurrentPlayoff(channel.name);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("showLeaderboard")
          .setLabel("Show Leaderboard")
          .setStyle(ButtonStyle.Primary),
      );

      if (showPlayoffButton) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("showPlayoffs")
            .setLabel("Show Playoffs")
            .setStyle(ButtonStyle.Primary),
        );
      }

      // Reply with score info
      await message.reply({
        content: retVal,
        files: [attachment],
        components: [row],
      });

      // Emit cross-post event
      const shouldPost =
        reHighScoreCheck.test(retVal) ||
        postToHighScoreChannel?.toLowerCase() === "y";

      this.container.client.emit("crossPostHighScore", {
        user,
        score: validation.value,
        attachment,
        currentWeek,
        channelId: process.env.HIGH_SCORES_CHANNEL_ID,
        postSubscript: `copied from <#${channel.id}>`,
        postDescription: "just posted a score for",
        doPost: shouldPost,
      });

      // Delete original message
      await message.delete().catch(() => {});
    } catch (e) {
      logger.error(e);
      const reply = await message.reply({
        content: `${e.message} This message will be deleted in 10 seconds.`,
      });
      await message.delete().catch(() => {});
      setTimeout(() => reply.delete().catch(() => {}), 10000);
    }
  }
}
