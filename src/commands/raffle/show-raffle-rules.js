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
        name: "📋 How to Enter",
        value:
          "After you've posted a score for the week, use `/enter-raffle` with a [vpsId](https://virtualpinballspreadsheet.github.io/) or [url](https://vpuniverse.com/files/category/82-vpx-pinball-tables/) of a table.",
      },
      {
        name: "🏆 Performance (max 4 tickets)",
        value:
          "+1 ticket for posting a score this week\n" +
          "+1 ticket for finishing Top 10\n" +
          "+2 tickets for finishing Top 3",
      },
      {
        name: "🔥 Persistence (max 3 tickets)",
        value: "+1 ticket for each of the previous 4 weeks you posted a score",
      },
      {
        name: "🎟 Maximum 7 total tickets per week",
        value: "More tickets = better odds.",
      },
      {
        name: "📌 Limit",
        value: "One entry per person per week.",
      },
    )
    .setColor("Red")
    .setFooter({
      text: "Use /change-raffle-entry to change your entry.",
    });

  return interaction.reply({ embeds: [embed], flags: 64 });
};
