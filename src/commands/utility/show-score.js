import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { EmbedBuilder } from "discord.js";
import { createTableRow } from "../../lib/output/leaderboard.js";
import { findCurrentWeek } from "../../services/database.js";
import { AsciiTable3, AlignmentEnum } from "ascii-table3";

export class ShowScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-score",
      description: "Show your current score and rank.",
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

      // Build a single-row ASCII table
      const headers = ["Rank", "User", "Score", "+/-", "Posted"];
      const row = createTableRow(rank, score, true, true);

      const table = new AsciiTable3()
        .setHeading(...headers)
        .setStyle("compact")
        .setCellMargin(0);

      table.setAlign(1, AlignmentEnum.RIGHT);
      table.setAlign(2, AlignmentEnum.LEFT);
      table.setAlign(3, AlignmentEnum.RIGHT);
      table.setWidths([5, 12, 12, 8, 16]);

      table.addRowMatrix([row]);

      const embed = new EmbedBuilder()
        .setTitle(`📊 Score for ${username}`)
        .setColor("#0099ff")
        .setDescription("```\n" + table.toString() + "\n```")
        .setFooter({
          text: `Rank ${rank} of ${numOfScores}`,
          iconURL: score.userAvatarUrl || null,
        });

      return interaction.reply({
        embeds: [embed],
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
