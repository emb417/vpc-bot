import "dotenv/config";
import { Command } from "@sapphire/framework";
import { PaginatedMessage } from "@sapphire/discord.js-utilities";
import { ButtonStyle, ComponentType } from "discord.js";
import logger from "../../utils/logger.js";
import {
  getScoresByVpsId,
  getScoresByTableAndAuthorUsingFuzzyTableSearch,
} from "../../lib/data/vpc.js";
import { findTable } from "../../lib/data/tables.js";
import {
  pickHighestVersion,
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
              .setName("tablesearchterm")
              .setDescription("Search term for table name")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("vpsid")
              .setDescription("VPS ID of the table")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("url")
              .setDescription("URL of the table")
              .setRequired(false),
          )
          .addBooleanOption((option) =>
            option
              .setName("isephemeral")
              .setDescription("Show results only to you"),
          ),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    const tableSearchTerm = interaction.options.getString("tablesearchterm");
    const vpsId = interaction.options.getString("vpsid");
    const url = interaction.options.getString("url");
    const isEphemeral = interaction.options.getBoolean("isephemeral") ?? true;

    if (!tableSearchTerm && !vpsId && !url) {
      return interaction.reply({
        content: `Please provide a table search term, VPS ID, or URL.\n\nVPC High Score Corner\n<${process.env.HIGH_SCORES_URL}>`,
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: isEphemeral ? 64 : undefined });

    try {
      let resolvedVpsId = vpsId;

      if (url && !vpsId) {
        const { table, error: tableError } = await findTable({ url });
        if (tableError || !table) {
          return interaction.editReply({
            content:
              tableError ??
              "Table not found by URL. Please try using a VPS ID or search term instead.",
          });
        }
        resolvedVpsId = table.vpsId;
      }

      if (resolvedVpsId) {
        // Single table — one image, no pagination needed
        const versions = await getScoresByVpsId(resolvedVpsId);
        if (!versions || versions.length === 0) {
          return interaction.editReply({ content: "No results found." });
        }

        const version = pickHighestVersion(versions);
        const imageBuffer = await fetchHighScoresImage(version.vpsId);
        const { embed, attachment } = buildHighScoresPage(version, imageBuffer);

        return interaction.editReply({ embeds: [embed], files: [attachment] });
      }

      // Search term path — one image per matching table, paginated
      const results =
        await getScoresByTableAndAuthorUsingFuzzyTableSearch(tableSearchTerm);

      if (!results || results.length === 0) {
        return interaction.editReply({
          content: `No tables found matching "${tableSearchTerm}".`,
        });
      }

      // Group by vpsId, pick highest version per group
      const grouped = results.reduce((acc, v) => {
        if (!acc[v.vpsId]) acc[v.vpsId] = [];
        acc[v.vpsId].push(v);
        return acc;
      }, {});
      const versions = Object.values(grouped).map(pickHighestVersion);

      // Fetch all images in parallel
      const settled = await Promise.allSettled(
        versions.map(async (version) => {
          const imageBuffer = await fetchHighScoresImage(version.vpsId);
          return buildHighScoresPage(version, imageBuffer);
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
        // Single result — skip pagination
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
