import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { createHighScoreTable } from "../../commands/highscores/create-high-score-table.js";

export class CreateHighScoreTableListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "createHighScoreTable",
      emitter: context.client,
    });
  }

  async run(data) {
    const { client, vpsId, interaction, channel } = data;

    try {
      const result = await createHighScoreTable(vpsId);

      if (!interaction.replied) {
        await interaction.followUp({
          content: `**Trying to create new high score table:** ${result}`,
        });
      } else {
        await channel.send({
          content: `**Trying to create new high score table:** ${result}`,
        });
      }
    } catch (e) {
      logger.error("Error in createHighScoreTable event:", e);
    }
  }
}
