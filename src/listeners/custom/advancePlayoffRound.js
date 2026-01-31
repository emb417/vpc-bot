import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import {
  getCurrentPlayoffMatchups,
  findWinningSeeds,
  getRoundName,
} from "../../lib/playoffs/matchups.js";
import {
  findOne,
  findCurrentSeason,
  updateOne,
  insertOne,
} from "../../services/database.js";

export class AdvancePlayoffRoundListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "advancePlayoffRound",
      emitter: context.client,
    });
  }

  async run(data) {
    const { client, interaction, currentWeek } = data;
    const channel = interaction.channel;

    try {
      const currentPlayoff = await findOne(
        { channelName: channel.name, isArchived: false },
        "playoffs",
      );

      if (!currentPlayoff) {
        return;
      }

      const currentPlayoffRound = await findOne(
        { channelName: channel.name, isArchived: false },
        "rounds",
      );

      if (!currentPlayoffRound) {
        return;
      }

      const games = getCurrentPlayoffMatchups(
        currentWeek,
        currentPlayoff,
        currentPlayoffRound,
      );

      const winningSeeds = findWinningSeeds(games);
      const roundName = getRoundName(winningSeeds.length);

      const currentSeason = await findCurrentSeason(channel.name);

      // Archive current round
      await updateOne(
        {
          seasonNumber: parseInt(currentSeason?.seasonNumber),
          isArchived: false,
        },
        { $set: { isArchived: true } },
        null,
        "rounds",
      );

      // Insert new round
      await insertOne(
        {
          channelName: channel.name,
          seasonNumber: parseInt(currentSeason?.seasonNumber),
          roundName,
          games: winningSeeds,
          isArchived: false,
        },
        "rounds",
      );

      await channel.send({
        content: `Advanced playoff round to: ${roundName}`,
      });
    } catch (e) {
      logger.error("Error in advancePlayoffRound:", e);
    }
  }
}
