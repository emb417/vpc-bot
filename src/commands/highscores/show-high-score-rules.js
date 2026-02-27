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
      "This channel is for VPC'ers to search, track, and post high scores in a more structured and competitive manner. Our friendly bot helps automate the tracking of high scores.",
    )
    .addFields(
      {
        name: "📋 Commands",
        value:
          "`/show-table-lists` — List all tables added to the database by our mods.\n" +
          "`/show-table-high-scores <tablesearchterm>` — Search the table list and return results.\n" +
          "`/post-high-score` or `!high <score> <tablesearchterm>` — Start the automated process to post your score. The bot will prompt you to select the specific table from the database.\n" +
          "**Example:** `!high 12000000 cactus`\n" +
          'This will let you choose from a list of tables with "cactus" in the name, then prompt you to select one.',
      },
      {
        name: "📸 Photo Required",
        value:
          "You **MUST** attach a photo when posting — you will **NOT** be able to add it afterwards.\n" +
          "The easiest way: add the photo as a new post, then type `!high 12000000 cactus` in the attachment notes.",
      },
      {
        name: "➕ Proposing New Tables",
        value:
          `Post in the channel with the VPS Id from [virtualpinballspreadsheet.github.io](https://virtualpinballspreadsheet.github.io/), tagged to <@&${process.env.BOT_HIGH_SCORE_ADMIN_ROLE_ID}>.\n\n` +
          "**Example:** Please add Skyway (Williams 1954). VPS Id: `qo-m1I-F`\n\n" +
          "We're rolling this out with a moderator model and will pivot if a better process emerges.",
      },
      {
        name: "🛡️ High Score Corner Mods",
        value:
          "<@339588163196682251>, <@370032314194853901>, <@305481877391802369>, <@395642748914499584>, <@580864208212852757>, <@418393486652342273>, <@1069383371127541800>",
      },
    )
    .setColor("Gold");

  return interaction.reply({ embeds: [embed], flags: 64 });
};
