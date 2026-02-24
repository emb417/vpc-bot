import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { findTable } from "../../lib/data/tables.js";

export class CreateHighScoreTableCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "create-high-score-table",
      description: "Creates new high score table.",
      preconditions: ["CompetitionAdminRole", "HighScoresChannel"],
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
              .setName("vpsid")
              .setDescription("VPS ID for the table")
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const vpsid = interaction.options.getString("vpsid");

    try {
      const { table, status, error } = await findTable({ vpsId: vpsid });

      if (error) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder().setColor("Red").setDescription(`❌ ${error}`),
          ],
          flags: 64,
        });
      }

      const {
        name,
        metadata: { authorName, versionNumber },
      } = table;

      const statusConfig = {
        existing: { color: "Blue", icon: "📋", label: "Table Already Exists" },
        new_author: { color: "Green", icon: "👤", label: "New Author Created" },
        new_version: {
          color: "Green",
          icon: "🆕",
          label: "New Version Created",
        },
        new_table: { color: "Green", icon: "✅", label: "Table Created" },
      };

      const { color, icon, label } = statusConfig[status] ?? {
        color: "Yellow",
        icon: "❓",
        label: "Unknown",
      };

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${icon} ${label}`)
        .addFields(
          { name: "Table", value: name, inline: false },
          { name: "Author", value: authorName, inline: true },
          { name: "Version", value: versionNumber, inline: true },
        );

      return interaction.reply({
        embeds: [embed],
        flags: 64,
      });
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        embeds: [
          new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
        ],
        flags: 64,
      });
    }
  }
}
