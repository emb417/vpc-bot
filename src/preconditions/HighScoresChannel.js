import "dotenv/config";
import { Precondition } from "@sapphire/framework";
import logger from "../utils/logger.js";

const HIGH_SCORES_CHANNEL_ID = process.env.HIGH_SCORES_CHANNEL_ID;

export class HighScoresChannelPrecondition extends Precondition {
  chatInputRun(interaction) {
    return this.checkChannel(interaction.channelId);
  }

  messageRun(message) {
    return this.checkChannel(message.channel.id);
  }

  checkChannel(channelId) {
    if (channelId === HIGH_SCORES_CHANNEL_ID) {
      return this.ok();
    }

    return this.error({
      identifier: "HighScoresChannel",
      message: `This command can only be used in the #${process.env.HIGH_SCORES_CHANNEL_NAME} channel.`,
    });
  }
}
