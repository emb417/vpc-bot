import "dotenv/config";
import { Precondition } from "@sapphire/framework";

const HIGH_SCORES_CHANNEL_ID = process.env.HIGH_SCORES_CHANNEL_ID;

export class HighScoresChannelPrecondition extends Precondition {
  chatInputRun(interaction) {
    return this.checkChannel(interaction.channelId);
  }

  messageRun(message) {
    return this.checkChannel(message.channel.id);
  }

  checkChannel(channelId) {
    return channelId === HIGH_SCORES_CHANNEL_ID
      ? this.ok()
      : this.error({
          message: "This command can only be used in the high scores channel.",
        });
  }
}
