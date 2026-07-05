import "dotenv/config";
import { Command } from "@sapphire/framework";
import { PaginatedMessage } from "@sapphire/discord.js-utilities";
import { ButtonStyle, ComponentType } from "discord.js";
import logger from "../../utils/logger.js";
import { getScoresByTableAndAuthorUsingFuzzyTableSearch } from "../../lib/data/vpc.js";
import { findTable } from "../../lib/data/tables.js";
import {
  fetchHighScoresImage,
  buildHighScoresPage,
} from "../../lib/output/highScoreEmbed.js";

const paginationActions = [
  {
    customId: "@sapphire/paginated-messages.previousPage",
    style: ButtonStyle.Secondary,
    emoji: "◀️",
    label: "Previous",
    type: ComponentType.Button,
    run: async ({ handler, interaction }) => {
      await interaction.deferUpdate();
      if (handler.index > 0) handler.index--;
    },
  },
  {
    customId: "@sapphire/paginated-messages.nextPage",
    style: ButtonStyle.Secondary,
    emoji: "▶️",
    label: "Next Page",
    type: ComponentType.Button,
    run: async ({ handler, interaction }) => {
      await interaction.deferUpdate();
      if (handler.index < handler.pages.length - 1) handler.index++;
    },
  },
];

export class ShowTableHighScoresCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-table-high-scores",
      description: "Search table high scores.",
      preconditions: ["HighScoresChannel"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option
              .setName("table")
              .setDescription("Table name, VPS ID, or URL")
              .setRequired(true),
          ),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    const tableInput = interaction.options.getString("table");
    const isUrl = /^https?:\/\//i.test(tableInput);

    await interaction.deferReply({ flags: 64 });

    try {
      // --- Direct path: URL or VPS ID ---
      if (isUrl || !tableInput.includes(" ")) {
        const { table, error: tableError } = await findTable(
          isUrl ? { url: tableInput } : { vpsId: tableInput },
        );

        if (table && !tableError) {
          const imageBuffer = await fetchHighScoresImage(table.vpsId);
          const { embed, attachment } = buildHighScoresPage(
            { vpsId: table.vpsId },
            imageBuffer,
          );
          return interaction.editReply({ embeds: [embed], files: [attachment] });
        }

        if (isUrl) {
          return interaction.editReply({
            content: tableError ?? "Table not found via URL. Please try a search term.",
          });
        }
      }

      // --- Search term path ---
      const results =
        await getScoresByTableAndAuthorUsingFuzzyTableSearch(tableInput);

      if (!results || results.length === 0) {
        return interaction.editReply({
          content: `No tables found matching "${tableInput}".`,
        });
      }

      const uniqueVpsIds = [...new Set(results.map((r) => r.vpsId))];

      const settled = await Promise.allSettled(
        uniqueVpsIds.map(async (id) => {
          const imageBuffer = await fetchHighScoresImage(id);
          return buildHighScoresPage({ vpsId: id }, imageBuffer);
        }),
      );

      const pages = settled
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);

      if (pages.length === 0) {
        return interaction.editReply({
          content: "Failed to generate leaderboard images.",
        });
      }

      if (pages.length === 1) {
        const { embed, attachment } = pages[0];
        return interaction.editReply({ embeds: [embed], files: [attachment] });
      }

      const paginatedMessage = new PaginatedMessage({
        actions: paginationActions,
      });
      pages.forEach(({ embed, attachment }) => {
        paginatedMessage.addPage({ embeds: [embed], files: [attachment] });
      });

      return paginatedMessage.run(interaction, interaction.user);
    } catch (e) {
      logger.error({ err: e }, e.message);
      return interaction.editReply({
        content: e.message ?? "An unexpected error occurred.",
      });
    }
  }
}
