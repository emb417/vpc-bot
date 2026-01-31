import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";

export class UnifiedLogger extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    let log = {
      user: interaction.user?.username,
      id: interaction.id,
    };

    if (interaction.isChatInputCommand()) {
      logger.info(
        `${interaction.user.username} used /${interaction.commandName} in #${interaction.channel.name}`,
      );
      return;
    }

    if (interaction.isMessageComponent()) {
      logger.info(
        `${interaction.user.username} used ${interaction.customId} button in #${interaction.channel.name}`,
      );
      return;
    }

    if (interaction.isModalSubmit()) {
      logger.info(
        `${interaction.user.username} used ${interaction.customId} modal in #${interaction.channel.name}`,
      );
      return;
    }
  }
}
