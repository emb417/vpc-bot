import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";

export class ShowTableListCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-table-list",
      description: "Show high score table list.",
      preconditions: ["HighScoreChannel"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description),
    );
  }

  async chatInputRun(interaction) {
    logger.info("Entering chatInputRun for show-table-list command.");
    try {
      const response = await interaction.reply({
        content:
          "For an up to date list of tables, please visit: \nhttps://virtualpinballchat.com:8443/highscores",
        flags: 64,
      });
      logger.info("Successfully replied to interaction.");
      return response;
    } catch (error) {
      logger.error(
        { error: error.message },
        "Error in show-table-list chatInputRun:",
      );
      // Attempt to reply with an error message if the initial reply failed
      try {
        await interaction.reply(
          "An error occurred while trying to fetch the table list.",
        );
      } catch (replyError) {
        logger.error(
          { replyError: replyError.message },
          "Failed to send error reply.",
        );
      }
      throw error; // re-throw the error so framework can catch it
    }
  }
}
