import "dotenv/config";
import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { find } from "../../services/database.js";
import {
  calculateRaffleDataWithStatus,
  loadApprovedTables,
} from "../../lib/raffle/raffle.js";
import logger from "../../utils/logger.js";

/**
 * Escape underscores in a string to prevent Discord markdown rendering
 * (italics/bold) in embed text. Only escapes when 2+ underscores are
 * present, since a single underscore renders fine.
 */
const escapeUnderscores = (str) => {
  if (!str) return "";
  return (str.match(/_/g)?.length ?? 0) >= 2 ? str.replace(/_/g, "\\_") : str;
};

const selectRaffleEntryButton = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("show_select_raffle_entry")
    .setLabel("🎯 Select Raffle Entry")
    .setStyle(ButtonStyle.Secondary),
);

export class ShowRaffleBoardCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-raffle-board",
      description: "Show the current weekly raffle board.",
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    return showRaffleBoard(interaction);
  }
}

export const showRaffleBoard = async (interaction) => {
  try {
    if (interaction.isButton()) {
      await interaction.deferReply({ flags: 64 });
    }
    const allWeeks = await find(
      { channelName: process.env.COMPETITION_CHANNEL_NAME },
      "weeks",
    );
    const currentWeek = allWeeks.find((w) => !w.isArchived);

    if (!currentWeek) {
      const msg = "No active competition week found.";
      return interaction.replied || interaction.deferred
        ? interaction.followUp({ content: msg, flags: 64 })
        : interaction.reply({ content: msg, flags: 64 });
    }

    const weekId = currentWeek._id.toString();
    const entries = await find({ weekId }, "raffles");

    if (!entries || entries.length === 0) {
      const msg = "No raffle entries yet this week. Use `/enter-raffle`.";
      return interaction.replied || interaction.deferred
        ? interaction.followUp({ content: msg, flags: 64 })
        : interaction.reply({ content: msg, flags: 64 });
    }

    const approvedTables = await loadApprovedTables();
    const raffleData = calculateRaffleDataWithStatus(
      allWeeks,
      entries,
      approvedTables,
    );

    const description = raffleData
      .map((user) => {
        const tableUrl = user.table.url;
        const tableName = user.table.name;
        const tableLink = tableUrl ? `[${tableName}](${tableUrl})` : tableName;
        const isPending = user.tableStatus.pending;
        const statusIcon = isPending ? ` ⏳ (${user.tableStatus.trophies}/3 🏆)` : "";
        const probability = isPending ? "0.0" : user.probability.toFixed(1);
        const username = escapeUnderscores(user.username);
        return `${user.tickets} 🎟 (${probability}%)  — #${user.rank}. ${username} (${user.performanceTickets} 🏆 ${user.persistenceTickets} 🔥) — ${tableLink}${statusIcon}`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🎟 Weekly Raffle Board")
      .setDescription(description)
      .setColor("Red")
      .setFooter({
        text: "Post a score to win a ticket,\nthen use /enter-raffle.",
      });

    const responseOptions = {
      embeds: [embed],
      components: [selectRaffleEntryButton],
    };

    if (interaction.isButton()) {
      await interaction.editReply(responseOptions);
    } else if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ ...responseOptions, flags: 64 });
    } else {
      await interaction.reply({ ...responseOptions, flags: 64 });
    }
  } catch (e) {
    logger.error({ err: e }, "Failed to show raffle board:");
    const msg = "An error occurred while fetching the raffle board.";
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: msg, flags: 64 });
    } else {
      await interaction.followUp({ content: msg, flags: 64 });
    }
  }
};
