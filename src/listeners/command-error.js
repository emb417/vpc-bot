import { Listener } from "@sapphire/framework";
import logger from "../utils/logging.js";

export class CommandErrorListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "chatInputCommandError",
    });
  }

  run(error, { command, interaction }) {
    logger.error(
      {
        command: command.name,
        user: interaction.user.username,
        error: error.message,
      },
      "Command failed",
    );
  }
}
