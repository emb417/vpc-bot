import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";

export class ReadyListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      once: true,
      event: "clientReady",
    });
  }

  run(client) {
    const { username, id } = client.user;
    logger.info(`Successfully logged in as ${username} (${id})`);
    logger.info(`Bot is ready for work`);
  }
}
