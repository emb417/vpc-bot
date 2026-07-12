import "dotenv/config";
import { Precondition } from "@sapphire/framework";
import { findCurrentlyActiveTournament } from "../services/database.js";

const COMPETITION_CHANNEL_ID = process.env.COMPETITION_CHANNEL_ID;

export class CompetitionOrTournamentChannelPrecondition extends Precondition {
  chatInputRun(interaction) {
    return this.checkChannel(interaction.channelId, interaction.channel?.name);
  }

  messageRun(message) {
    return this.checkChannel(message.channel.id, message.channel.name);
  }

  async checkChannel(channelId, channelName) {
    if (channelId === COMPETITION_CHANNEL_ID) {
      return this.ok();
    }

    if (channelName) {
      const tournament = await findCurrentlyActiveTournament(channelName);
      if (tournament) {
        return this.ok();
      }
    }

    return this.error({
      identifier: "CompetitionOrTournamentChannel",
      message: `This command can only be used in the #${process.env.COMPETITION_CHANNEL_NAME} channel or an active tournament channel.`,
    });
  }
}
