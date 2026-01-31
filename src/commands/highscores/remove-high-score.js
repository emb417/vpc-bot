import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { findOneAndUpdate } from "../../services/database.js";

export class RemoveHighScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "remove-high-score",
      description: "Remove high score from a high score table.",
      preconditions: ["CompetitionAdminRole", "HighScoresChannel"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName("vpsid")
            .setDescription("VPS ID of the table")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("username")
            .setDescription("Username of the score to remove")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("score")
            .setDescription("Score value to remove")
            .setRequired(true),
        ),
    );
  }

  async chatInputRun(interaction) {
    const vpsId = interaction.options.getString("vpsid");
    const username = interaction.options.getString("username");
    const score = interaction.options.getInteger("score");

    try {
      const result = await removeHighScore(vpsId, username, score);
      return interaction.reply({
        content: result,
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

// Export for use by other modules
export const removeHighScore = async (vpsId, username, score) => {
  const filter = { authors: { $elemMatch: { vpsId } } };
  const update = {
    $pull: {
      "authors.$[].versions.$[].scores": {
        username,
        score: parseInt(score),
      },
    },
  };

  const response = await findOneAndUpdate(
    filter,
    update,
    { new: true },
    "tables",
  );

  if (response) {
    return "Score removed successfully.";
  }
  return "No score removed. Score not found.";
};
