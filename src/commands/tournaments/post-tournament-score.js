import "dotenv/config";
import { Command } from "@sapphire/framework";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import logger from "../../utils/logger.js";
import {
  formatNumber,
  tournamentWindowStatus,
} from "../../utils/formatting.js";
import { processScore, validateScore } from "../../lib/scores/scoring.js";
import {
  TOURNAMENT_POINTS_BY_RANK,
  calculateSeasonPoints,
} from "../../lib/scores/points.js";
import {
  findActiveTournament,
  findOne,
  updateOne,
  updateMany,
} from "../../services/database.js";

export class PostTournamentScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "post-tournament-score",
      description: "Post a score for a table in the active tournament.",
      preconditions: ["TournamentChannel"],
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
              .setName("table")
              .setDescription("Which table this score is for")
              .setRequired(true)
              .setAutocomplete(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async autocompleteRun(interaction) {
    const channelName = interaction.channel?.name;
    const tournament = channelName
      ? await findActiveTournament(channelName)
      : null;

    if (!tournament) {
      return interaction.respond([]);
    }

    const focused = interaction.options.getFocused().toLowerCase();
    const choices = (tournament.tables ?? [])
      .filter((t) => !focused || t.table.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((t) => ({
        name: t.table.slice(0, 100),
        value: String(t.tableIndex),
      }));

    return interaction.respond(choices);
  }

  async chatInputRun(interaction) {
    const score = interaction.options.getString("score") ?? "<score>";
    const attachment = interaction.options.getAttachment("image");
    const tableIndex = interaction.options.getString("table");

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

    await this.handleTournamentScore(
      fakeMessage,
      interaction.user,
      score,
      tableIndex,
    );

    return interaction.editReply({
      content: "✅ Score posted successfully.",
    });
  }

  async handleTournamentScore(message, user, scoreValue, tableIndex) {
    const channel = message.channel;

    try {
      const validation = validateScore(scoreValue);
      if (!validation.valid) {
        const reply = await message.reply({
          content: `${validation.error} This message will be deleted in 10 seconds.`,
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
      }

      const attachment = message.attachments?.first();
      if (!attachment) {
        const reply = await message.reply({
          content:
            "No photo attached. Please attach a photo with your score.\n" +
            "This message will be deleted in 10 seconds.",
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
      }

      let attachmentBuffer;
      try {
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        attachmentBuffer = Buffer.from(await response.arrayBuffer());
      } catch (fetchError) {
        logger.error({ err: fetchError }, "Failed to download attachment:");
        const reply = await message.reply({
          content: "Failed to process image. Please try again.",
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
      }

      const tournament = await findActiveTournament(channel.name);
      if (!tournament) {
        return message.reply({
          content: "No active tournament found for this channel.",
        });
      }

      const windowStatus = tournamentWindowStatus(
        tournament.startDate,
        tournament.endDate,
      );
      if (windowStatus !== "open") {
        const msg =
          windowStatus === "pending"
            ? `⏳ This tournament hasn't started yet. It begins on ${tournament.startDate}.`
            : `🏁 This tournament ended on ${tournament.endDate}.`;
        const reply = await message.reply({
          content: `${msg} This message will be deleted in 10 seconds.`,
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
      }

      const tableEntry = (tournament.tables ?? []).find(
        (t) => String(t.tableIndex) === String(tableIndex),
      );

      if (!tableEntry) {
        const reply = await message.reply({
          content:
            "That table was not found in this tournament. Please pick a table from the list. " +
            "This message will be deleted in 10 seconds.",
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
      }

      // Process the score with F1-style tournament points
      const result = processScore(user, validation.value, tableEntry, {
        pointsTable: TOURNAMENT_POINTS_BY_RANK,
      });

      // Persist the updated scores for this table only
      await updateOne(
        { channelName: channel.name, status: "active" },
        { $set: { "tables.$[t].scores": result.scores } },
        { arrayFilters: [{ "t.tableIndex": tableEntry.tableIndex }] },
        "tournaments",
      );

      this.updateHistoricalAvatars(user).catch((e) =>
        logger.error({ err: e }, "Error updating historical avatars:"),
      );

      const standings = calculateSeasonPoints(
        (tournament.tables ?? []).map((t) =>
          t.tableIndex === tableEntry.tableIndex
            ? { scores: result.scores }
            : { scores: t.scores ?? [] },
        ),
      );
      const standingKey = result.username.toLowerCase();
      const standingIndex = standings.findIndex(
        (s) => s.username === standingKey,
      );
      const totalPoints = standings[standingIndex]?.points ?? 0;
      const overallRank = `${standingIndex + 1} of ${standings.length}`;

      logger.info(
        `${user.username} posted tournament score: ${result.scoreAsInt} for ${tableEntry.table} (${tournament.name}) ranked ${result.currentRank}, ${totalPoints} total points`,
      );

      const description =
        `**User:** ${user.username}\n` +
        `**Tournament:** ${tournament.name}\n` +
        `**Table:** ${tableEntry.table}\n` +
        `**Score:** ${formatNumber(result.scoreAsInt)} (${result.scoreDiff >= 0 ? "+" : ""}${formatNumber(result.scoreDiff)})\n`;

      const title = result.currentRank.startsWith("1 of")
        ? "🥇  NEW TOP SCORE"
        : "🏆  NEW SCORE";

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .addFields(
          {
            name: "Table Rank",
            value: `${result.currentRank} (${result.rankChange >= 0 ? "+" + result.rankChange : result.rankChange})`,
            inline: true,
          },
          {
            name: "Tournament Points",
            value: `${totalPoints} pts (${overallRank})`,
            inline: true,
          },
        )
        .setImage("attachment://score.png")
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setColor("Green");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("showTournamentLeaderboard")
          .setLabel("📋 Leaderboard")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("showTournamentRules")
          .setLabel("📜 Rules")
          .setStyle(ButtonStyle.Secondary),
      );

      await channel.send({
        embeds: [embed],
        files: [{ attachment: attachmentBuffer, name: "score.png" }],
        components: [row],
      });

      // Cross-post to the high scores channel / table, same as /post-score.
      // The listener only reads table metadata (table/authorName/versionNumber/
      // vpsId/mode) from `currentWeek`, all of which a tournament table has.
      this.container.client.emit("crossPostHighScore", {
        user,
        score: validation.value,
        attachmentBuffer,
        currentWeek: tableEntry,
        channelId: process.env.HIGH_SCORES_CHANNEL_ID,
        postSubscript: `🔗 <#${channel.id}>`,
      });

      await message.delete().catch(() => {});
    } catch (e) {
      logger.error({ err: e }, "Error in PostTournamentScoreCommand:");
      const reply = await message.reply({
        content: `${e.message} This message will be deleted in 10 seconds.`,
      });
      await message.delete().catch(() => {});
      setTimeout(() => reply.delete().catch(() => {}), 10000);
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
