import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { getRoundName } from "../../lib/playoffs/matchups.js";
import {
  findCurrentSeason,
  updateOne,
  insertOne,
} from "../../services/database.js";

const COMPETITION_CHANNEL = process.env.COMPETITION_CHANNEL_NAME;

export class CreatePlayoffRoundCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "create-playoff-round",
      description: "Creates a new playoff round manually.",
      preconditions: ["CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName("games")
            .setDescription("Comma-separated list of seed numbers for matchups")
            .setRequired(true),
        ),
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;

    // Check if in valid channel
    if (channel.name !== COMPETITION_CHANNEL) {
      return interaction.reply({
        content:
          "This command can only be used in the competition corner channel.",
        flags: 64,
      });
    }

    try {
      const gamesInput = interaction.options.getString("games");
      const gamesList = gamesInput.split(",").map((s) => parseInt(s.trim()));

      if (gamesList.length % 2 !== 0) {
        return interaction.reply({
          content: "Games must be provided in pairs (even number of seeds).",
          flags: 64,
        });
      }

      const currentSeason = await findCurrentSeason(channel.name);
      const seasonNumber = currentSeason?.seasonNumber
        ? parseInt(currentSeason.seasonNumber)
        : null;

      const roundName = getRoundName(gamesList.length);

      // Archive current round
      await updateOne(
        { channelName: channel.name, isArchived: false },
        { $set: { isArchived: true } },
        null,
        "rounds",
      );

      // Insert new round
      const round = {
        channelName: channel.name,
        seasonNumber,
        roundName,
        games: gamesList,
        isArchived: false,
      };
      await insertOne(round, "rounds");

      return interaction.reply({
        content: `New playoff round created: ${roundName} with matchups: ${gamesInput}`,
        flags: 64,
      });
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}
