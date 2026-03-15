import { Listener } from "@sapphire/framework";
import { InteractionType } from "discord.js";
import logger from "../../utils/logger.js";
import { getLeaderboard } from "../../commands/competition/show-leaderboard.js";

export class ShowLeaderboardButtonListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.type !== InteractionType.MessageComponent) return;
    if (interaction.customId !== "showLeaderboard") return;

    try {
      await interaction.deferReply({ flags: 64 });
      const channel =
        interaction.channel ??
        (await interaction.client.channels.fetch(interaction.channelId));
      await getLeaderboard(interaction, channel);
    } catch (e) {
      logger.error({ err: e }, "Failed to show leaderboard:");
      const replyMethod = interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: e.message,
        flags: 64,
      });
    }
  }
}
