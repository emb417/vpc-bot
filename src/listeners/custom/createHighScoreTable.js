import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { findTable } from "../../lib/data/tables.js";

export class CreateHighScoreTableListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "createHighScoreTable",
      emitter: context.client,
    });
  }

  async run(data) {
    const { vpsId } = data;

    try {
      await findTable({ vpsId });
    } catch (e) {
      logger.error("Error in createHighScoreTable event:", e.message, e.stack);
    }
  }
}
