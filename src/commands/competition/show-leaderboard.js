import "dotenv/config";
import { Command } from "@sapphire/framework";
import { PaginatedMessage } from "@sapphire/discord.js-utilities";
import {
  EmbedBuilder,
  AttachmentBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { findCurrentWeek } from "../../services/database.js";

const showLeaderboard = async (currentWeek, interaction) => {
  const { vpsId, table, versionNumber, scores = [] } = currentWeek;
  const scoreCount = scores.length;

  const apiUrl = `${process.env.VPC_DATA_SERVICE_API_URI}/generateWeeklyLeaderboard`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channelName: currentWeek.channelName,
      layout: "portrait",
      allowMultipleImages: true,
      numRows: 20,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  const paginatedMessage = new PaginatedMessage({
    actions: [
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
    ],
  });

  if (contentType?.includes("application/json")) {
    const { images } = await response.json();

    images.forEach((dataUri, index) => {
      const base64Data = dataUri.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `leaderboard-${index}.png`;

      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setImage(`attachment://${fileName}`);

      if (index === 0) {
        embed
          .setTitle("🏆  Weekly Leaderboard")
          .setDescription(
            scoreCount === 0
              ? "NO SCORES CURRENTLY POSTED"
              : `**${table}** v${versionNumber}\nVPS ID: \`${vpsId}\` - ${scoreCount} score${scoreCount !== 1 ? "s" : ""} posted`,
          );
      }

      if (index === images.length - 1) {
        embed
          .addFields({
            name: "🌟  VPC Competition Corner",
            value: `<${process.env.COMPETITIONS_URL}>`,
          })
          .setFooter({ text: "📌  How to Post: /post-score" });
      }

      paginatedMessage.addPage({
        embeds: [embed],
        files: [new AttachmentBuilder(buffer, { name: fileName })],
      });
    });
  } else {
    // Single-image fallback — still run through PaginatedMessage for consistency
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: "leaderboard.png",
    });

    const embed = new EmbedBuilder()
      .setTitle("🏆  Weekly Leaderboard")
      .setColor("#0099ff")
      .setDescription(
        scoreCount === 0
          ? "NO SCORES CURRENTLY POSTED"
          : `**${table}** v${versionNumber}\nVPS ID: \`${vpsId}\` - ${scoreCount} score${scoreCount !== 1 ? "s" : ""} posted`,
      )
      .setImage("attachment://leaderboard.png")
      .addFields({
        name: "🌟  VPC Competition Corner",
        value: `<${process.env.COMPETITIONS_URL}>`,
      })
      .setFooter({ text: "📌  How to Post: /post-score" });

    paginatedMessage.addPage({
      embeds: [embed],
      files: [attachment],
    });
  }

  await paginatedMessage.run(interaction, interaction.user);
};

export class ShowLeaderboardCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-leaderboard",
      description: "Show leaderboard for a competition channel.",
      preconditions: ["CompetitionChannel"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    try {
      await interaction.deferReply({ flags: 64 });
      const channel = interaction.channel;
      const currentWeek = await findCurrentWeek(channel.name);

      if (!currentWeek) {
        return interaction.editReply({
          content: "No active week found for this channel.",
        });
      }

      await showLeaderboard(currentWeek, interaction);
    } catch (e) {
      console.error("SHOW-LEADERBOARD ERROR:", e);
      const replyMethod = interaction.deferred ? "editReply" : "reply";
      return interaction[replyMethod]({
        content: e.message,
        flags: 64,
      });
    }
  }
}

export const getLeaderboard = async (interaction, channel) => {
  const currentWeek = await findCurrentWeek(channel.name);
  if (!currentWeek) {
    return interaction.editReply({ content: "No active week found." });
  }
  await showLeaderboard(currentWeek, interaction);
};
