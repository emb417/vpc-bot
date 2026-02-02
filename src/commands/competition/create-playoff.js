import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { generateBracket, getRoundName } from "../../lib/playoffs/matchups.js";
import {
  findCurrentSeason,
  updateOne,
  insertOne,
} from "../../services/database.js";

const COMPETITION_CHANNEL = process.env.COMPETITION_CHANNEL_NAME;

export class CreatePlayoffCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "create-playoff",
      description: "Creates new playoff bracket.",
      preconditions: ["CompetitionChannel", "CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option
              .setName("seeds")
              .setDescription(
                "Comma-separated list of seeds (e.g., user1,user2,user3,...)",
              )
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
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
      const seedsInput = interaction.options.getString("seeds");
      const seedList = seedsInput.split(",").map((s) => s.trim());

      if (seedList.length !== 8 && seedList.length !== 16) {
        return interaction.reply({
          content: "Playoffs require either 8 or 16 seeds.",
          flags: 64,
        });
      }

      const currentSeason = await findCurrentSeason(channel.name);
      const seasonNumber = currentSeason?.seasonNumber
        ? parseInt(currentSeason.seasonNumber)
        : null;

      // Create seeds array with usernames
      const seeds = seedList.map((username, index) => ({
        seed: index + 1,
        username: username,
      }));

      // Archive current playoff
      await updateOne(
        { channelName: channel.name, isArchived: false },
        { $set: { isArchived: true } },
        null,
        "playoffs",
      );

      // Insert new playoff
      const playoff = {
        channelName: channel.name,
        seasonNumber,
        seeds,
        isArchived: false,
      };
      await insertOne(playoff, "playoffs");

      // Create first round
      const bracket = generateBracket(seedList.length);
      const roundName = getRoundName(seedList.length);

      // Archive current round
      await updateOne(
        { channelName: channel.name, isArchived: false },
        { $set: { isArchived: true } },
        null,
        "rounds",
      );

      // Insert first round
      const round = {
        channelName: channel.name,
        seasonNumber,
        roundName,
        games: bracket,
        isArchived: false,
      };
      await insertOne(round, "rounds");

      const seedDisplay = seeds
        .map((s) => `${s.seed}. ${s.username}`)
        .join("\n");

      return interaction.reply({
        content: `Playoff created with ${seedList.length} seeds:\n\`\`\`\n${seedDisplay}\n\`\`\`\nFirst round: ${roundName}`,
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
