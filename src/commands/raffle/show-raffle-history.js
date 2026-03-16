import "dotenv/config";
import { Command } from "@sapphire/framework";
import { PaginatedMessage } from "@sapphire/discord.js-utilities";
import { EmbedBuilder, ButtonStyle, ComponentType } from "discord.js";
import { find } from "../../services/database.js";
import logger from "../../utils/logger.js";

const ENTRIES_PER_PAGE = 10;

const buildPaginatedMessage = (entries, target) => {
  const sorted = entries.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  const pages = [];
  for (let i = 0; i < sorted.length; i += ENTRIES_PER_PAGE) {
    pages.push(sorted.slice(i, i + ENTRIES_PER_PAGE));
  }

  const paginatedMessage = new PaginatedMessage({
    actions: [
      {
        customId: "@sapphire/paginated-messages.previousPage",
        style: ButtonStyle.Secondary,
        emoji: "◀️",
        label: "Previous",
        type: ComponentType.Button,
        run: ({ handler }) => {
          if (handler.index > 0) handler.index--;
        },
      },
      {
        customId: "@sapphire/paginated-messages.nextPage",
        style: ButtonStyle.Secondary,
        emoji: "▶️",
        label: "Next Page",
        type: ComponentType.Button,
        run: ({ handler }) => {
          if (handler.index < handler.pages.length - 1) handler.index++;
        },
      },
    ],
  });

  pages.forEach((pageEntries, index) => {
    const description = pageEntries
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
      .setFooter({
        text: `${entries.length} total entries · Page ${index + 1} of ${pages.length}`,
      });

    paginatedMessage.addPage({ embeds: [embed] });
  });

  return paginatedMessage;
};

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
      await interaction.deferReply({ flags: 64 });

      const target = interaction.options.getUser("user") ?? interaction.user;
      const entries = await find({ userId: target.id }, "raffles");

      if (!entries || entries.length === 0) {
        return interaction.editReply({
          content: `No raffle entries found for **${target.username}**.`,
        });
      }

      const paginatedMessage = buildPaginatedMessage(entries, target);
      return paginatedMessage.run(interaction, interaction.user);
    } catch (e) {
      logger.error({ err: e }, e.message);
      const replyMethod = interaction.deferred ? "editReply" : "reply";
      return interaction[replyMethod]({
        content: "An error occurred while fetching raffle entries.",
        flags: 64,
      });
    }
  }
}
