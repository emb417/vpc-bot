import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import { find } from "../../services/database.js";
import logger from "../../utils/logger.js";

export class ShowRaffleHistoryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-raffle-history",
      description: "Show all historical raffle entries for a user.",
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to look up (defaults to you)")
              .setRequired(false),
          ),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    try {
      const target = interaction.options.getUser("user") ?? interaction.user;
      const userId = target.id;

      const entries = await find({ userId }, "raffles");

      if (!entries || entries.length === 0) {
        return interaction.reply({
          content: `No raffle entries found for **${target.username}**.`,
          flags: 64,
        });
      }

      const description = entries
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((entry) => {
          const tableLink = entry.table.url
            ? `[${entry.table.name}](${entry.table.url})`
            : entry.table.name;
          const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          return `**${date}** — ${tableLink}`;
        })
        .join("\n");

      const embed = new EmbedBuilder()
        .setTitle(`🎟 Raffle History — ${target.username}`)
        .setDescription(description)
        .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 128 }))
        .setColor("Red")
        .setFooter({ text: `${entries.length} total entries` });

      return interaction.reply({ embeds: [embed], flags: 64 });
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: "An error occurred while fetching raffle entries.",
        flags: 64,
      });
    }
  }
}
