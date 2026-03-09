import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { findCurrentWeek } from "../../services/database.js";

const showLeaderboard = async (currentWeek, interaction) => {
  const { vpsId, table, versionNumber, scores = [] } = currentWeek;

  const apiUrl = `${process.env.VPC_DATA_SERVICE_API_URI}/generateWeeklyLeaderboard`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channelName: currentWeek.channelName,
      layout: "discord",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard image: ${response.status}`);
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const attachment = new AttachmentBuilder(imageBuffer, {
    name: "leaderboard.png",
  });

  const scoreCount = scores.length;
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

  await interaction.editReply({
    embeds: [embed],
    files: [attachment],
  });
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
      const channel = interaction.channel;
      const currentWeek = await findCurrentWeek(channel.name);

      if (!currentWeek) {
        return interaction.reply({
          content: "No active week found for this channel.",
          flags: 64,
        });
      }

      await interaction.deferReply({ flags: 64 });
      await showLeaderboard(currentWeek, interaction);
    } catch (e) {
      logger.error(e);
      const replyMethod = interaction.deferred ? "editReply" : "reply";
      return interaction[replyMethod]({
        content: e.message,
        flags: 64,
      });
    }
  }
}

// Export for use by button handlers
export const getLeaderboard = async (interaction, channel) => {
  const currentWeek = await findCurrentWeek(channel.name);
  if (!currentWeek) {
    return interaction.editReply({ content: "No active week found." });
  }
  await showLeaderboard(currentWeek, interaction);
};
