import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";

export class ShowHighScoreRulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-high-score-rules",
      description: "Show the High Score Corner rules.",
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    return showHighScoreRules(interaction);
  }
}

export const showHighScoreRules = async (interaction) => {
  const embed = new EmbedBuilder()
    .setTitle("🎰 Welcome to HIGH SCORE CORNER")
    .setDescription(
      "This channel is dedicated for posting high scores directly, instead of waiting for a future weekly competition. Our score bot helps automate the tracking of high scores using slash commands.",
    )
    .addFields(
      {
        name: "📋 Commands",
        value:
          "`/show-table-high-scores` — Provide table VPS ID, URL, or name search terms. The bot will find the table and automatically show the leaderboard or might prompt you to select one from a list.\n" +
          "`/post-high-score` — Post your score. Attach an image. Provide table VPS ID, URL, or name search terms. The bot will find the table and automatically post the score or might prompt you to select one from a list.",
      },
      {
        name: "➕ Adding Tables",
        value:
          "Tables are pulled directly from [VPS](https://virtualpinballspreadsheet.github.io/) — no mod approval needed. If the table isn't in our database yet, it will be added automatically when you post your score.",
      },
    )
    .setColor("Gold");

  return interaction.reply({ embeds: [embed], flags: 64 });
};
