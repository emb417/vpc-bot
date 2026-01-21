import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
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
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
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
    );
  }

  async chatInputRun(interaction) {
    const tableSearchTerm = interaction.options.getString("tablesearchterm");
    const vpsId = interaction.options.getString("vpsid");
    const isEphemeral = interaction.options.getBoolean("isephemeral") ?? true;

    try {
      let tables = null;

      if (tableSearchTerm) {
        tables =
          await getScoresByTableAndAuthorUsingFuzzyTableSearch(tableSearchTerm);
      }

      if (vpsId) {
        tables = await getScoresByVpsId(vpsId);
      }

      if (!tableSearchTerm && !vpsId) {
        return interaction.reply({
          content: "Please provide either a table search term or VPS ID.",
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
        content: e.message,
        flags: 64,
      });
    }
  }

  async showHighScoreTables(tables, searchTerm, interaction, isEphemeral) {
    const contentArray = printHighScoreTables(searchTerm, tables || [], 10, 5);

    for (const post of contentArray) {
      if (!isEphemeral && interaction.channel) {
        await interaction.channel.send(post);
      } else if (!interaction.replied) {
        await interaction.reply({ content: post, flags: 64 });
      } else {
        await interaction.followUp({ content: post, flags: 64 });
      }
    }
  }
}
