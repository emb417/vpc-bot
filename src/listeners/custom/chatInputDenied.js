import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";

export class ChatInputDeniedListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "chatInputCommandDenied",
    });
  }

  async run(error, { interaction }) {
    try {
      if (!interaction || interaction.replied) {
        return;
      }

      const content = error.message || "You cannot use this command.";

      if (interaction.deferred) {
        await interaction.editReply({
          content,
        });
      } else {
        await interaction.reply({
          content,
          flags: 64,
        });
      }
    } catch (e) {
      logger.error("Error in ChatInputDeniedListener:", e);
    }
  }
}
