import "dotenv/config";
import { Command } from "@sapphire/framework";
import Table from "easy-table";
import logger from "../../utils/logging.js";
import { createTableRow } from "../../lib/output/leaderboard.js";
import { findCurrentWeek } from "../../services/database.js";

export class ShowScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-score",
      description: "Show current score for user.",
      preconditions: ["CompetitionChannel"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description),
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;
    const username = interaction.user.username;

    try {
      const currentWeek = await findCurrentWeek(channel.name);

      if (!currentWeek) {
        return interaction.reply({
          content: "No active week found for this channel.",
          flags: 64,
        });
      }

      const score = currentWeek.scores?.find((x) => x.username === username);

      if (!score) {
        return interaction.reply({
          content: `No score found for ${username}.`,
          flags: 64,
        });
      }

      const rank =
        currentWeek.scores.findIndex((x) => x.username === username) + 1;
      const numOfScores = currentWeek.scores.length;

      const t = new Table();
      createTableRow(`${rank} of ${numOfScores}`, t, score, true, true);

      return interaction.reply({
        content: "`" + t.toString() + "`",
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
