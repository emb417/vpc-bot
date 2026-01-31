import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";

export class ShowCommandsCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-commands",
      description: "Shows all available commands.",
      preconditions: ["CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description),
    );
  }

  async chatInputRun(interaction) {
    try {
      const commands = this.container.stores.get("commands");
      let result = "**Available Commands:**\n\n";

      for (const [name, command] of commands) {
        result += `**/${name}**: ${command.description}\n`;
      }

      return interaction.reply({
        content: result,
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
