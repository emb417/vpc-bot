import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { printHighScoreTables } from "../../lib/output/tables.js";
import {
  getScoresByTableAndAuthorUsingFuzzyTableSearch,
  getScoresByVpsId,
} from "../../lib/data/vpc.js";

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
              .setDescription("Search term for table name"),
          )
          .addStringOption((option) =>
            option.setName("vpsid").setDescription("VPS ID to search by"),
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
    const isEphemeral = interaction.options.getBoolean("isephemeral") ?? true;

    try {
      const tables = vpsId
        ? await getScoresByVpsId(vpsId)
        : await getScoresByTableAndAuthorUsingFuzzyTableSearch(tableSearchTerm);

      if (!tableSearchTerm && !vpsId) {
        return interaction.reply({
          content: `Please provide either a table search term or VPS ID.\n\nVPC High Score Corner\n<${process.env.HIGH_SCORES_URL}>`,
          flags: 64,
        });
      }

      await this.showHighScoreTables(
        tables,
        tableSearchTerm || vpsId,
        interaction,
        isEphemeral,
      );
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message ?? "An unexpected error occurred.",
        flags: 64,
      });
    }
  }

  async showHighScoreTables(tables, searchTerm, interaction, isEphemeral) {
    const contentArray = printHighScoreTables(searchTerm, tables || [], 10, 5);

    for (let post of contentArray) {
      // If post is a string, send as content
      if (typeof post === "string") {
        if (!isEphemeral && interaction.channel) {
          await interaction.channel.send({ content: post });
        } else if (!interaction.replied) {
          await interaction.reply({ content: post, flags: 64 });
        } else {
          await interaction.followUp({ content: post, flags: 64 });
        }
        continue;
      }

      // If post is an embed, send as embed
      if (!isEphemeral && interaction.channel) {
        await interaction.channel.send({ embeds: [post] });
      } else if (!interaction.replied) {
        await interaction.reply({ embeds: [post], flags: 64 });
      } else {
        await interaction.followUp({ embeds: [post], flags: 64 });
      }
    }
  }
}
