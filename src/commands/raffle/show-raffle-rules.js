import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";

export class ShowRaffleRulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-raffle-rules",
      description: "Show the weekly raffle rules.",
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
    return showRaffleRules(interaction);
  }
}

export const showRaffleRules = async (interaction) => {
  const embed = new EmbedBuilder()
    .setTitle("🎟 Weekly Raffle – How It Works")
    .setDescription(
      "Each week, one table is randomly selected for next week's competition, based on your raffle entry.",
    )
    .addFields(
      {
        name: "📜 How to Enter",
        value:
          "After you've posted a score for the week, use `/enter-raffle` with a [vpsId](https://virtualpinballspreadsheet.github.io/) or [url](https://vpuniverse.com/files/category/82-vpx-pinball-tables/) of a table that has NOT been played in the last 52 weeks.",
      },
      {
        name: "🏆 Performance (max 4 tickets)",
        value:
          "+1 ticket for posting (1 🏆)\n" +
          "+1 ticket for Top 10 (2 🏆 total)\n" +
          "+2 tickets for Top 3 (4 🏆 total)",
      },
      {
        name: "🔥 Persistence (max 3 tickets)",
        value: "+1 ticket for each of the previous 4 weeks you posted a score.",
      },
      {
        name: "🎯 Entering Tables",
        value:
          "Tables on the [**Approved List**](https://docs.google.com/spreadsheets/d/1cQoj3uVV78KGRRJqWSiJSbSZ-LLP5Kp1M2aNMCJj4X4/edit?usp=sharing) are pre-qualified. Tables NOT on the list require a combined **3 🏆 Trophies** from players who enter it to qualify.\n" +
          "• **Solo:** A Top 3 player (4 🏆) unlocks it alone.\n" +
          "• **Team Up:** Combine trophies with others to hit 3 🏆.\n" +
          "• **Track:** Check `/show-raffle-board` for the **Pending (⏳)** icon.",
      },
      {
        name: "⚖️ The Bottom Line",
        value:
          "If you want a new table, place higher on `/show-leaderboard` or recruit allies! Unqualified entries are discarded at week's end.",
      },
    )
    .setColor("Red")
    .setFooter({
      text: "Limit: One entry per person. Use /change-raffle-entry to change your pick.",
    });

  return interaction.reply({ embeds: [embed], flags: 64 });
};
