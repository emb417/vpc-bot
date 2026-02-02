import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import {
  findCurrentWeek,
  updateOne,
  findOneAndUpdate,
} from "../../services/database.js";

export class RemoveScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "remove-score",
      description: "Remove score by rank from current competition.",
      preconditions: ["CompetitionChannel", "CompetitionAdminRole"],
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
          .addIntegerOption((option) =>
            option
              .setName("rank")
              .setDescription("Rank of the score to remove")
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;
    const rank = interaction.options.getInteger("rank");

    try {
      const currentWeek = await findCurrentWeek(channel.name);

      if (!currentWeek) {
        return interaction.reply({
          content: "No active week found for this channel.",
          flags: 64,
        });
      }

      if (rank < 1 || rank > currentWeek.scores.length) {
        return interaction.reply({
          content: `Invalid rank. Valid range is 1-${currentWeek.scores.length}.`,
          flags: 64,
        });
      }

      // Get the score being removed
      const scoreToRemove = currentWeek.scores[rank - 1];
      const username = scoreToRemove.username;
      const score = scoreToRemove.score;

      // Remove score based on rank/index
      currentWeek.scores.splice(rank - 1, 1);

      // Save scores to db
      await updateOne(
        { channelName: channel.name, isArchived: false },
        { $set: { scores: currentWeek.scores } },
        null,
        "weeks",
      );

      // Also remove from high scores table
      const filter = { authors: { $elemMatch: { vpsId: currentWeek.vpsId } } };
      const update = {
        $pull: {
          "authors.$[].versions.$[].scores": {
            username: username,
            score: parseInt(score),
          },
        },
      };
      await findOneAndUpdate(filter, update, { new: true }, "tables");

      return interaction.reply({
        content: `Score removed successfully. ${username}'s score of ${score} has been removed from rank ${rank}.`,
        flags: 64,
      });
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
