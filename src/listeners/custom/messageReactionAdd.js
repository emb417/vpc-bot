import { Listener } from "@sapphire/framework";
import { Events } from "discord.js";
import logger from "../../utils/logger.js";
import {
  findCurrentWeek,
  updateOne,
  findOneAndUpdate,
  findCurrentlyActiveTournament,
} from "../../services/database.js";
import { removeTournamentScore } from "../../commands/tournaments/remove-tournament-score.js";
import { removeHighScore } from "../../commands/highscores/remove-high-score.js";

const threshold = 5;

export class MessageReactionAddListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: Events.MessageReactionAdd,
    });
  }

  async run(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        logger.error({ err: error }, "Failed to fetch reaction:");
        return;
      }
    }

    if (reaction.emoji.name !== "❔") return;

    const message = reaction.message;
    if (message.author.id !== this.container.client.user.id) return;

    const isCompetitionChannel =
      message.channel.id === process.env.COMPETITION_CHANNEL_ID;
    const tournament = isCompetitionChannel
      ? null
      : await findCurrentlyActiveTournament(message.channel.name);

    if (!isCompetitionChannel && !tournament) return;

    const embed = message.embeds[0];
    if (!embed || !embed.description) return;

    const usernameMatch = embed.description.match(/\*\*User:\*\* ([^\n\r]+)/);
    if (!usernameMatch) return;

    const username = usernameMatch[1].trim();

    logger.info(
      `Moderation reaction: ${user.username} gave a ❔ to score repost for User: ${username} in ${message.channel.name}`,
    );

    const count = reaction.count;
    if (count < threshold) return;

    try {
      if (tournament) {
        const tableMatch = embed.description.match(/\*\*Table:\*\* ([^\n\r]+)/);
        if (!tableMatch) {
          logger.warn(
            `Could not extract table from embed in ${message.channel.name}`,
          );
          return;
        }

        const tableName = tableMatch[1].trim();
        const tableEntry = tournament.tables.find((t) => t.table === tableName);
        if (!tableEntry) {
          logger.warn(
            `Could not resolve table name ${tableName} to index in ${message.channel.name}`,
          );
          return;
        }

        const result = await removeTournamentScore(
          message.channel.name,
          tableEntry.tableIndex,
          username,
        );

        if (result) {
          await removeHighScore(result.vpsId, username, result.score.score);

          await message.delete().catch(() => {});

          await message.channel.send(
            `Community Moderation: ${username}'s score of ${result.score.score} on ${result.tableName} was removed due to ${threshold} ❔ reactions.`,
          );
          logger.info(
            `Tournament score for ${result.score.username} removed via community moderation in ${message.channel.name}`,
          );
        }
      } else {
        const currentWeek = await findCurrentWeek(message.channel.name);
        if (!currentWeek) return;

        const scoreIndex = currentWeek.scores.findIndex(
          (s) => s.username === username,
        );
        if (scoreIndex === -1) return;

        const scoreToRemove = currentWeek.scores[scoreIndex];

        currentWeek.scores.splice(scoreIndex, 1);

        await updateOne(
          { channelName: message.channel.name, isArchived: false },
          { $set: { scores: currentWeek.scores } },
          null,
          "weeks",
        );

        const filter = {
          authors: { $elemMatch: { vpsId: currentWeek.vpsId } },
        };
        const update = {
          $pull: {
            "authors.$[].versions.$[].scores": {
              username: scoreToRemove.username,
              score: parseInt(scoreToRemove.score),
            },
          },
        };
        await findOneAndUpdate(filter, update, { new: true }, "tables");

        await message.delete().catch(() => {});

        await message.channel.send(
          `Community Moderation: ${username}'s score of ${scoreToRemove.score} was removed due to ${threshold} ❔ reactions.`,
        );
        logger.info(
          `Score for ${scoreToRemove.username} removed via community moderation in ${message.channel.name}`,
        );
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to process community moderation:");
    }
  }
}
