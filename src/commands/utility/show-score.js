import "dotenv/config";
import { Command } from "@sapphire/framework";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import logger from "../../utils/logger.js";
import {
  findCurrentWeek,
  findCurrentPlayoff,
} from "../../services/database.js";
import { formatNumber } from "../../utils/formatting.js";

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

      const replyMessage =
        `📊 **Score Summary**\n\n` +
        `**Week:** ${currentWeek.weekNumber}\n` +
        `**User:** <@${interaction.user.id}>\n` +
        `**Table:** ${currentWeek.table}\n` +
        `**Mode:** ${score.mode}\n` +
        `**Score:** ${formatNumber(score.score)} ` +
        `(${score.diff >= 0 ? "+" : ""}${formatNumber(score.diff)})\n` +
        `**Posted:** ${score.posted}\n`;

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

      return interaction.reply({
        content: replyMessage,
        components: [row],
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
