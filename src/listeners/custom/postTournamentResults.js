import { Listener } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { formatNumber } from "../../utils/formatting.js";

export class PostTournamentResultsListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "postTournamentResults",
      emitter: context.client,
    });
  }

  async run(data) {
    const { client, tournament, endedDate, winner, topFinishers, channelIds } =
      data;

    // Skip if there's no winner to celebrate
    if (!winner?.userId) {
      return;
    }

    try {
      const user = await client.users.fetch(winner.userId);

      let description =
        `**End Date:** ${endedDate ?? tournament.endDate}\n` +
        `**Champion:** ${user.username}\n` +
        `**Points:** ${winner.points}\n`;

      if (topFinishers?.length > 1) {
        const podium = topFinishers
          .slice(0, 3)
          .map(
            (f, i) =>
              `${i + 1}. ${f.username} — ${f.points} pts (${formatNumber(f.score)})`,
          )
          .join("\n");
        description += `\n**Top Finishers:**\n${podium}\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Tournament Complete: ${tournament.name} 🏆`)
        .setDescription(description)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setColor("Random");

      const payload = {
        content: `${user}`,
        embeds: [embed],
        allowedMentions: {
          users: [user.id],
        },
      };

      // Post to both the tournament channel and the bragging-rights channel.
      const targets = [...new Set(channelIds)].filter(Boolean);
      for (const channelId of targets) {
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
          logger.error(`postTournamentResults: channel ${channelId} not found`);
          continue;
        }
        await channel.send(payload);
      }
    } catch (e) {
      logger.error({ err: e }, "Error in postTournamentResults:");
    }
  }
}
