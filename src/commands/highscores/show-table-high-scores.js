import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { printHighScoreTables } from "../../lib/output/tables.js";
import {
  getScoresByTableAndAuthorUsingFuzzyTableSearch,
  getScoresByVpsId,
} from "../../lib/data/vpc.js";
import { findTable } from "../../lib/data/tables.js";

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
      {
        guildIds: [guildId],
      },
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

      // Resolve vpsId from URL if needed
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
        const tables = await getScoresByVpsId(resolvedVpsId);
        await this.showHighScoreTables(
          tables,
          resolvedVpsId,
          interaction,
          isEphemeral,
        );
      } else {
        const tables =
          await getScoresByTableAndAuthorUsingFuzzyTableSearch(tableSearchTerm);
        await this.showHighScoreTables(
          tables,
          tableSearchTerm,
          interaction,
          isEphemeral,
        );
      }
    } catch (e) {
      logger.error(e);
      return interaction.editReply({
        content: e.message ?? "An unexpected error occurred.",
      });
    }
  }

  async showHighScoreTables(tables, searchTerm, interaction, isEphemeral) {
    const contentArray = printHighScoreTables(searchTerm, tables || [], 10, 2);

    for (const post of contentArray) {
      const payload =
        typeof post === "string" ? { content: post } : { embeds: [post] };

      if (!isEphemeral && interaction.channel) {
        await interaction.channel.send(payload);
      } else if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ ...payload, flags: 64 });
      } else {
        await interaction.followUp({ ...payload, flags: 64 });
      }
    }
  }
}
