import "dotenv/config";
import { Precondition } from "@sapphire/framework";
import { findActiveTournament } from "../services/database.js";

export class TournamentChannelPrecondition extends Precondition {
  chatInputRun(interaction) {
    return this.checkChannel(interaction.channel?.name);
  }

  messageRun(message) {
    return this.checkChannel(message.channel.name);
  }

  async checkChannel(channelName) {
    if (channelName) {
      const tournament = await findActiveTournament(channelName);
      if (tournament) {
        return this.ok();
      }
    }

    return this.error({
      identifier: "TournamentChannel",
      message: "This command can only be used in an active tournament channel.",
    });
  }
}
