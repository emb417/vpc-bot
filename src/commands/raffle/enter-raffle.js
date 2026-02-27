import "dotenv/config";
import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import {
  find,
  findOne,
  findCurrentWeek,
  insertOne,
} from "../../services/database.js";
import { validateEntry } from "../../lib/scores/raffle.js";
import { findTable } from "../../lib/data/tables.js";
import logger from "../../utils/logger.js";

export class EnterRaffleCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "enter-raffle",
      description: "Enter a table for the weekly raffle.",
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
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
          .addStringOption((option) =>
            option
              .setName("notes")
              .setDescription("Optional notes")
              .setRequired(false),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const vpsId = interaction.options.getString("vpsid");
    const url = interaction.options.getString("url");
    const notes = interaction.options.getString("notes");

    if (!vpsId && !url) {
      return interaction.reply({
        content: "You must provide either a `vpsid` or a `url`.",
        flags: 64,
      });
    }

    try {
      const currentWeek = await findCurrentWeek(
        process.env.COMPETITION_CHANNEL_NAME,
      );
      if (!currentWeek) {
        return interaction.reply({
          content: "No active competition week found.",
          flags: 64,
        });
      }

      const weekId = currentWeek._id.toString();
      const userId = interaction.user.id;

      // Check if already entered
      const existingEntry = await findOne({ userId, weekId }, "raffles");
      if (existingEntry) {
        return interaction.reply({
          content:
            "You have already entered a table for this week. Use `/change-raffle-entry` to update it.",
          flags: 64,
        });
      }

      // Find table
      const { table, error: tableError } = await findTable({ vpsId, url });
      if (tableError) {
        return interaction.reply({
          content: tableError,
          flags: 64,
        });
      }
      if (!table) {
        return interaction.reply({
          content:
            "Table not found. This should have been caught by specific errors.",
          flags: 64,
        });
      }

      // Validate entry rules
      const validation = await validateEntry(userId, table, currentWeek);
      if (!validation.valid) {
        return interaction.reply({
          content: validation.error,
          flags: 64,
        });
      }

      // Save entry
      const entry = {
        userId,
        weekId,
        table: {
          name: table.name,
          url: table.url,
          vpsId: table.vpsId,
          romUrl: table.romUrl,
          notes: notes || null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await insertOne(entry, "raffles");

      if (validation.warning) {
        const allEntries = await find({ weekId }, "raffles");
        const combinedTrophies = allEntries
          .filter((e) => e.table.vpsId === table.vpsId)
          .reduce((sum, e) => {
            const userScore = currentWeek.scores?.find(
              (s) => s.userId === e.userId,
            );
            if (!userScore) return sum;
            const rank =
              [...currentWeek.scores]
                .sort((a, b) => b.score - a.score)
                .findIndex((s) => s.userId === e.userId) + 1;
            let performanceTickets = 1;
            if (rank <= 10) performanceTickets += 1;
            if (rank <= 3) performanceTickets += 2;
            return sum + performanceTickets;
          }, 0);

        if (combinedTrophies >= 3) {
          validation.warning = null;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle("🎟 New Raffle Entry")
        .setDescription(
          `**${interaction.user.username}** entered\n[${table.name}](${table.url})${validation.warning ? `\n\n⏳ ${validation.warning}` : ""}`,
        )
        .setColor(validation.warning ? "Yellow" : "Green")
        .setThumbnail(
          interaction.user.displayAvatarURL({ dynamic: true, size: 128 }),
        )
        .setFooter({
          text: "Use /change-raffle-entry to change your entry.",
        });

      const raffleBoardButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("show_raffle_board")
          .setLabel("Show Raffle Board")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("show_raffle_rules")
          .setLabel("Show Raffle Rules")
          .setStyle(ButtonStyle.Secondary),
      );

      return interaction.reply({
        embeds: [embed],
        components: [raffleBoardButtons],
      });
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: "An error occurred while processing your entry.",
        flags: 64,
      });
    }
  }
}
