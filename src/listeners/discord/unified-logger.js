import { Listener } from "@sapphire/framework";
import logger from "../../utils/logging.js";

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
        `interaction type=slash command=${interaction.commandName} user=${interaction.user.username}`,
      );
      return;
    }

    if (interaction.isMessageComponent()) {
      logger.info(
        `interaction type=component customId=${interaction.customId} user=${interaction.user.username}`,
      );
      return;
    }

    if (interaction.isModalSubmit()) {
      logger.info(
        `interaction type=modal customId=${interaction.customId} user=${interaction.user.username}`,
      );
      return;
    }
  }
}
