import { Listener } from "@sapphire/framework";
import logger from "../../utils/logging.js";

export class UnifiedErrorLogger extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "commandError",
    });
  }

  run(error, payload) {
    const { command, message, interaction } = payload;

    const log = {
      type: command?.constructor?.name ?? "unknown",
      command: command?.name ?? "unknown",
      user:
        interaction?.user?.username ?? message?.author?.username ?? "Unknown",
      error: error?.message ?? String(error),
    };

    logger.error(
      `commandError type=${log.type} command=${log.command} user=${log.user} error="${log.error}"`,
    );
  }
}
