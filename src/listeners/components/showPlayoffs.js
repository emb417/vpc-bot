import { Listener } from "@sapphire/framework";
import { InteractionType } from "discord.js";
import logger from "../../utils/logging.js";
import { getPlayoffRoundMatchups } from "../../commands/competition/show-playoffs.js";

export class ShowPlayoffsButtonListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.type !== InteractionType.MessageComponent) return;
    if (interaction.customId !== "showPlayoffs") return;

    try {
      await getPlayoffRoundMatchups(interaction, interaction.channel);
    } catch (e) {
      logger.error(e);
      if (!interaction.replied) {
        await interaction.reply({
          content: e.message,
          flags: 64,
        });
      }
    }
  }
}
