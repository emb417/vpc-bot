import "dotenv/config";
import { Command } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import logger from "../../utils/logger.js";
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
          )
          .addStringOption((option) =>
            option
              .setName("posttohighscorechannel")
              .setDescription("Post to high score channel (y/n)")
              .setRequired(false),
          ),
      {
        guildIds: [guildId],
      },
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
    const score = interaction.options.getString("score") ?? "<score>";
    const postToHighScore = interaction.options.getString(
      "posttohighscorechannel",
    );
    const attachment = interaction.options.getAttachment("image");

    await interaction.reply({
      content: "Posting score...",
      flags: 64,
    });

    const fakeMessage = {
      channel: interaction.channel,
      author: interaction.user,
      attachments: { first: () => attachment },
      reply: (opts) => interaction.channel.send(opts),
      delete: () => Promise.resolve(),
    };

    await this.handleScore(
      fakeMessage,
      interaction.user,
      score,
      postToHighScore,
      false,
    );

    return interaction.editReply({
      content: "✅ Score posted successfully.",
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
            "No photo attached. Please attach a photo with your score.\n" +
            `\`!score ${validation.value}\`\n` +
            "This message will be deleted in 10 seconds.",
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
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
        logger.error("Failed to download attachment:", fetchError);
        const reply = await message.reply({
          content: "Failed to process image. Please try again.",
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
        `**Score:** ${formatNumber(result.scoreAsInt)} (${result.scoreDiff >= 0 ? "+" : ""}${formatNumber(result.scoreDiff)})\n` +
        `**Rank:** ${result.currentRank} (${result.rankChange >= 0 ? "+" + result.rankChange : result.rankChange})`;

      // Compact one-line log
      logger.info(
        `${user.username} posted weekly score: ${result.scoreAsInt} for ${currentWeek.table} ranked ${result.currentRank}`,
      );

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
      await message.channel.send({
        content: retVal,
        files: [
          {
            attachment: attachmentBuffer,
            name: attachmentName,
          },
        ],
        components: [row],
      });

      // Emit cross-post event
      const shouldPost =
        reHighScoreCheck.test(retVal) ||
        postToHighScoreChannel?.toLowerCase() === "y";

      this.container.client.emit("crossPostHighScore", {
        user,
        score: validation.value,
        attachmentBuffer,
        attachmentName,
        currentWeek,
        channelId: process.env.HIGH_SCORES_CHANNEL_ID,
        postSubscript: `copied from <#${channel.id}>`,
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
