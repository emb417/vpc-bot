import "dotenv/config";
import { Precondition } from "@sapphire/framework";

const COMPETITION_CHANNEL_ID = process.env.COMPETITION_CHANNEL_ID;

export class CompetitionChannelPrecondition extends Precondition {
  chatInputRun(interaction) {
    return this.checkChannel(interaction.channelId);
  }

  messageRun(message) {
    return this.checkChannel(message.channel.id);
  }

  checkChannel(channelId) {
    return channelId === COMPETITION_CHANNEL_ID
      ? this.ok()
      : this.error({
          message: "This command can only be used in the competition channel.",
        });
  }
}
