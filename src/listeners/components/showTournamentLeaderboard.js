import { Listener } from "@sapphire/framework";
import { InteractionType } from "discord.js";
import logger from "../../utils/logger.js";
import { getTournamentLeaderboard } from "../../commands/tournaments/show-tournament-leaderboard.js";

export class ShowTournamentLeaderboardButtonListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.type !== InteractionType.MessageComponent) return;
    if (interaction.customId !== "showTournamentLeaderboard") return;

    try {
      await interaction.deferReply({ flags: 64 });
      const channel =
        interaction.channel ??
        (await interaction.client.channels.fetch(interaction.channelId));
      await getTournamentLeaderboard(interaction, channel);
    } catch (e) {
      logger.error({ err: e }, "Failed to show tournament leaderboard:");
      const replyMethod = interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: e.message,
        flags: 64,
      });
    }
  }
}
