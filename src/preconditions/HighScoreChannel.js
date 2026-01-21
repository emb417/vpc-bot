import "dotenv/config";
import { Precondition } from "@sapphire/framework";
import logger from "../utils/logging.js";

const HIGHSCORE_CHANNEL_NAME = process.env.HIGHSCORES_CHANNEL_NAME;

export class HighScoreChannelPrecondition extends Precondition {
  chatInputRun(interaction) {
    return this.checkChannel(interaction.channel?.name);
  }

  messageRun(message) {
    return this.checkChannel(message.channel?.name);
  }

  checkChannel(channelName) {
    logger.info(
      { channelName: channelName },
      "Checking HighScoreChannel precondition for channel:",
    );
    return channelName === HIGHSCORE_CHANNEL_NAME
      ? this.ok()
      : this.error({
          message: "This command can only be used in the high scores channel.",
        });
  }
}
