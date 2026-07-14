import "dotenv/config";
import { Precondition } from "@sapphire/framework";
import { find } from "../services/database.js";

export class ActiveTournamentChannelPrecondition extends Precondition {
  chatInputRun(interaction) {
    return this.checkChannel(interaction.channel?.name);
  }

  messageRun(message) {
    return this.checkChannel(message.channel.name);
  }

  async checkChannel(channelName) {
    if (channelName) {
      const tournaments = await find({ channelName, status: "active" }, "tournaments");
      if (tournaments && tournaments.length > 0) {
        return this.ok();
      }
    }

    return this.error({
      identifier: "ActiveTournamentChannel",
      message: "This command can only be used in a channel with an active tournament.",
    });
  }
}
