import "dotenv/config";
import { Precondition } from "@sapphire/framework";
import logger from "../utils/logging.js";

const COMPETITION_CHANNEL_NAME = process.env.COMPETITION_CHANNEL_NAME;

export class CompetitionChannelPrecondition extends Precondition {
  chatInputRun(interaction) {
    return this.checkChannel(interaction.channel?.name);
  }

  messageRun(message) {
    return this.checkChannel(message.channel?.name);
  }

  checkChannel(channelName) {
    logger.info(
      { channelName: channelName },
      "Checking CompetitionChannel precondition for channel:",
    );
    return channelName === COMPETITION_CHANNEL_NAME
      ? this.ok()
      : this.error({
          message: "This command can only be used in the competition channel.",
        });
  }
}
