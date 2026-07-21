import "dotenv/config";
import { Command } from "@sapphire/framework";
import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { find } from "../../services/database.js";
import { getTodayPacific } from "../../utils/formatting.js";

export class RemoveTournamentCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "remove-tournament",
      description:
        "Remove a scheduled tournament that has not yet started.",
      preconditions: ["TournamentChannel", "CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const channelName = interaction.channel?.name;

    try {
      if (!channelName) {
        return interaction.reply({
          content: "Could not determine the channel name.",
          flags: 64,
        });
      }

      const tournaments = await find(
        { channelName: channelName, status: "active" },
        "tournaments",
      );

      if (!tournaments || tournaments.length === 0) {
        return interaction.reply({
          content: "No active tournaments found for this channel.",
          flags: 64,
        });
      }

      const today = getTodayPacific();

      const removableTournaments = tournaments.filter(
        (t) => today < t.startDate,
      );

      if (removableTournaments.length === 0) {
        return interaction.reply({
          content:
            "No future tournaments found.",
          flags: 64,
        });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("remove_tournament_select")
        .setPlaceholder("Select a tournament to remove")
        .addOptions(
          removableTournaments.slice(0, 25).map((t) => ({
            label: t.name.slice(0, 100),
            description: `${t.startDate} to ${t.endDate}`,
            value: String(t._id),
          })),
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return interaction.reply({
        content: "Please select the tournament you wish to remove:",
        components: [row],
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to execute remove-tournament command:");
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
