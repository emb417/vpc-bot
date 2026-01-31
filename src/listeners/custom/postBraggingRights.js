import { Listener } from "@sapphire/framework";
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

      await braggingRightsChannel.send({
        content:
          `**Week:** ${currentWeek.weekNumber}\n` +
          `**End Date:** ${currentWeek.periodEnd}\n` +
          (winner.userId
            ? `**User: <@${winner.userId}>**\n`
            : `**User: ${winner.username}**\n`) +
          `**Score:** ${formatNumber(winner.score)}\n` +
          `**Table:** ${currentWeek.table}\n` +
          `**Table Link:** ${currentWeek.tableUrl}\n` +
          `**VPS Id:** ${currentWeek.vpsId}\n` +
          `**Version Number:** v${currentWeek.versionNumber}`,
      });
    } catch (e) {
      logger.error("Error in postBraggingRights:", e);
    }
  }
}
