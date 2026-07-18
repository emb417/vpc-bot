import "dotenv/config";
import { Command } from "@sapphire/framework";
import { PaginatedMessage } from "@sapphire/discord.js-utilities";
import {
  EmbedBuilder,
  AttachmentBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import logger from "../../utils/logger.js";
import { findCurrentlyActiveTournament } from "../../services/database.js";
import { formatLongDate } from "../../utils/formatting.js";

export class ShowTournamentLeaderboardCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-tournament-leaderboard",
      description: "Show the overall standings for the active tournament.",
      preconditions: ["TournamentChannel"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply({ flags: 64 });
    const channel =
      interaction.channel ??
      (await interaction.client.channels.fetch(interaction.channelId));
    return getTournamentLeaderboard(interaction, channel);
  }
}

// Export for use by the button listener and the command above.
export const getTournamentLeaderboard = async (interaction, channel) => {
  try {
    const tournament = await findCurrentlyActiveTournament(channel.name);

    if (!tournament) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("Red")
            .setDescription("❌ No active tournament found for this channel."),
        ],
      });
    }

    const apiUrl = `${process.env.VPC_DATA_SERVICE_API_URI}/generateTournamentLeaderboard`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId: tournament._id,
        allowMultipleImages: true,
        numRows: 20,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard image: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    const paginatedMessage = new PaginatedMessage();

    paginatedMessage.setActions([
      {
        customId: "@sapphire/paginated-messages.previousPage",
        style: ButtonStyle.Secondary,
        emoji: "◀️",
        label: "Previous Page",
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
    ]);

    const tournamentUrl = `${process.env.TOURNAMENTS_URL}/${tournament._id}`;
    const description = `Ends on ${formatLongDate(tournament.endDate)}`;

    if (contentType?.includes("application/json")) {
      const { images } = await response.json();

      images.forEach((dataUri, index) => {
        const base64Data = dataUri.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");
        const fileName = `leaderboard-${index}.png`;

        const embed = new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle(`🏆 ${tournament.name}`)
          .setURL(tournamentUrl)
          .setDescription(description)
          .setImage(`attachment://${fileName}`);

        paginatedMessage.addPage({
          embeds: [embed],
          files: [new AttachmentBuilder(buffer, { name: fileName })],
        });
      });
    } else {
      // Single-image fallback
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "leaderboard.png",
      });

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(`🏆 ${tournament.name}`)
        .setURL(tournamentUrl)
        .setDescription(description)
        .setImage("attachment://leaderboard.png");

      paginatedMessage.addPage({
        embeds: [embed],
        files: [attachment],
      });
    }

    await paginatedMessage.run(interaction, interaction.user);
  } catch (e) {
    logger.error({ err: e }, "Failed to show tournament leaderboard:");
    return interaction.editReply({
      embeds: [
        new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
      ],
    });
  }
};
