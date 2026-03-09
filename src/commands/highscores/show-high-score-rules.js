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
          "`/show-table-high-scores <tablesearchterm>` — Search the table list and return results.\n" +
          "`/post-high-score` or `!high <score> <tablesearchterm>` — Post your score. Provide a search term, VPS ID, or table URL. The bot will find the table and prompt you to confirm.\n" +
          "**Example:** `!high 12000000 cactus`\n" +
          'This will let you choose from a list of VPS tables with "cactus" in the name.',
      },
      {
        name: "📸 Photo Required",
        value:
          "You **MUST** attach a photo when posting — you will **NOT** be able to add it afterwards.\n" +
          "The easiest way: add the photo as a new post, then type `!high 12000000 cactus` in the attachment notes.",
      },
      {
        name: "➕ Adding Tables",
        value:
          "Tables are pulled directly from [VPS](https://virtualpinballspreadsheet.github.io/) — no mod approval needed.\n\n" +
          "Use any of the following with `/post-high-score`:\n" +
          "• **Search term** — finds matching tables from VPS by name\n" +
          "• **VPS ID** — looks up the exact table (`vpsid: qo-m1I-F`)\n" +
          "• **Table URL** — resolves the table from its download URL\n\n" +
          "If the table isn't in our database yet, it will be added automatically when you post your score.",
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
