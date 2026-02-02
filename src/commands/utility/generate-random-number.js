import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";

export class GenerateRandomNumberCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "generate-random-number",
      description: "Generate a random number between 1 and X.",
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
          .addIntegerOption((option) =>
            option
              .setName("max")
              .setDescription("Maximum number")
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const max = interaction.options.getInteger("max");

    try {
      if (max < 1) {
        return interaction.reply({
          content: "Maximum number must be at least 1.",
          flags: 64,
        });
      }

      const randomNumber = Math.floor(Math.random() * max) + 1;

      return interaction.reply({
        content: `**${randomNumber}** (1 - ${max})`,
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
