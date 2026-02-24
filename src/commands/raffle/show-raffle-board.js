import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import { find } from "../../services/database.js";
import { calculateRaffleData } from "../../lib/scores/raffle.js";
import logger from "../../utils/logger.js";

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

    const raffleData = calculateRaffleData(allWeeks, entries);
    const description = raffleData
      .map((user) => {
        const tableUrl = user.table.url;
        const tableName = user.table.name;
        const tableLink = tableUrl ? `[${tableName}](${tableUrl})` : tableName;
        return `${user.tickets} 🎟 (${user.probability.toFixed(1)}%)  — #${user.rank}. ${user.username} (${user.performanceTickets} 🏆 ${user.persistenceTickets} 🔥) — ${tableLink}`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🎟 Weekly Raffle Board")
      .setDescription(description)
      .setColor("Red")
      .setFooter({
        text: "Post a score to win a ticket,\nthen use /enter-raffle.",
      });

    const responseOptions = { embeds: [embed] };

    if (interaction.isButton()) {
      await interaction.editReply(responseOptions);
    } else if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ ...responseOptions, flags: 64 });
    } else {
      await interaction.reply({ ...responseOptions, flags: 64 });
    }
  } catch (e) {
    logger.error(e);
    const msg = "An error occurred while fetching the raffle board.";
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: msg, flags: 64 });
    } else {
      await interaction.followUp({ content: msg, flags: 64 });
    }
  }
};
