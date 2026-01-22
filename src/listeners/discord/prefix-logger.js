import { Listener } from "@sapphire/framework";
import logger from "../../utils/logging.js";

export class PrefixLogger extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "messageCreate",
    });
  }

  run(message) {
    if (message.author.bot) return;

    if (message.content.startsWith("!")) {
      const commandName = message.content.split(" ")[0];

      logger.info(
        `prefixCommand type=prefix command=${commandName} user=${message.author.username}`,
      );
    }
  }
}
