import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";

export class CreateMessageCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "create-message",
      description: "Creates new placeholder message authored by the bot.",
      preconditions: ["CompetitionChannel", "CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    try {
      return interaction.reply({
        content: "Placeholder message created successfully.",
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
