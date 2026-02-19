import { Listener } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { formatNumber } from "../../utils/formatting.js";

export class PostBraggingRightsListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "postBraggingRights",
      emitter: context.client,
    });
  }

  async run(data) {
    const { client, channelId, currentWeek } = data;

    // Skip if no scores to report
    if (!currentWeek?.scores?.length) {
      return;
    }

    try {
      const braggingRightsChannel = client.channels.cache.get(channelId);

      if (!braggingRightsChannel) {
        logger.error(`Bragging rights channel ${channelId} not found`);
        return;
      }

      const winner = currentWeek.scores[0];
      const user = await client.users.fetch(winner.userId);

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Braggin' Rights - Week ${currentWeek.weekNumber} 🏆`)
        .setDescription(
          `**End Date:** ${currentWeek.periodEnd}\n` +
            `**User:** <@${winner.userId}>\n` +
            `**VPS Id:** ${currentWeek.vpsId}\n` +
            `**Table:** [${currentWeek.table} v${currentWeek.versionNumber}](${currentWeek.tableUrl})\n` +
            `**Score:** ${formatNumber(winner.score)}\n`,
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setColor("Random");

      await braggingRightsChannel.send({ embeds: [embed] });
    } catch (e) {
      logger.error("Error in postBraggingRights:", e);
    }
  }
}
