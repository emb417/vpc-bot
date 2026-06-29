import "dotenv/config";
import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import logger from "../../utils/logger.js";
import { formatNumber } from "../../utils/formatting.js";
import {
  isEntryQualified,
  loadApprovedTables,
  notifyQualificationChange,
} from "../../lib/raffle/raffle.js";
import { processScore, validateScore } from "../../lib/scores/scoring.js";
import {
  TOURNAMENT_POINTS_BY_RANK,
  calculateSeasonPoints,
} from "../../lib/scores/points.js";
import { editWeeklyCompetitionCornerMessage } from "../../lib/output/messages.js";
import {
  find,
  findCurrentWeek,
  findActiveTournament,
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
      aliases: ["score"],
      description: "Post score for a competition channel.",
      preconditions: ["CompetitionOrTournamentChannel"],
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
              .setDescription(
                "(Tournament channels) which table this score is for",
              )
              .setRequired(false)
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
      null,
    );
  }

  async chatInputRun(interaction) {
    const score = interaction.options.getString("score") ?? "<score>";
    const postToHighScore = interaction.options.getString(
      "posttohighscorechannel",
    );
    const attachment = interaction.options.getAttachment("image");
    const tableIndex = interaction.options.getString("table");

    // Tournament channels require a table selection
    const tournament = await findActiveTournament(interaction.channel?.name);
    if (tournament && !tableIndex) {
      return interaction.reply({
        content:
          "Please choose which table this score is for using the `table` option.",
        flags: 64,
      });
    }

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
      tableIndex,
    );

    return interaction.editReply({
      content: "✅ Score posted successfully.",
    });
  }

  async handleScore(message, user, score, postToHighScoreChannel, tableIndex) {
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
        logger.error({ err: fetchError }, "Failed to download attachment:");
        const reply = await message.reply({
          content: "Failed to process image. Please try again.",
        });
        await message.delete().catch(() => {});
        setTimeout(() => reply.delete().catch(() => {}), 10000);
        return;
      }

      // Tournament channel — route to tournament scoring
      const tournament = await findActiveTournament(channel.name);
      if (tournament) {
        return this.handleTournamentScore(
          message,
          user,
          validation.value,
          tableIndex,
          attachmentBuffer,
          tournament,
        );
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
        .setImage("attachment://score.png")
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
      await message.channel.send({
        embeds: [embed],
        files: [{ attachment: attachmentBuffer, name: "score.png" }],
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

      await message.delete().catch(() => {});
    } catch (e) {
      logger.error({ err: e }, "Error in PostScoreCommand:");
      const reply = await message.reply({
        content: `${e.message} This message will be deleted in 10 seconds.`,
      });
      await message.delete().catch(() => {});
      setTimeout(() => reply.delete().catch(() => {}), 10000);
    }
  }

  async handleTournamentScore(
    message,
    user,
    scoreValue,
    tableIndex,
    attachmentBuffer,
    tournament,
  ) {
    const channel = message.channel;

    if (!tableIndex) {
      const reply = await message.reply({
        content:
          "Please choose which table this score is for using the `table` option of `/post-score`. " +
          "This message will be deleted in 10 seconds.",
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
    const result = processScore(user, scoreValue, tableEntry, {
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

    await channel.send({
      embeds: [embed],
      files: [{ attachment: attachmentBuffer, name: "score.png" }],
    });

    await message.delete().catch(() => {});
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
