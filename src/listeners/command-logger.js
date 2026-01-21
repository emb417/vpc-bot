import { Listener } from "@sapphire/framework";
import logger from "../utils/logging.js";

export class CommandLogger extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "chatInputCommandSuccess",
    });
  }

  run({ command, interaction }) {
    logger.info(
      {
        command: command.name,
        user: interaction.user.username,
      },
      "Command executed",
    );
  }
}
