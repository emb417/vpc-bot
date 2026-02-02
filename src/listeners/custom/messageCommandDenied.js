import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";

export class MessageCommandDeniedListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "messageCommandDenied",
    });
  }

  async run(error, { message }) {
    try {
      await message.reply(error.message || "You cannot use this command.");
    } catch (e) {
      logger.error("Error in MessageCommandDeniedListener:", e);
    }
  }
}
