import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";

const COMPETITION_CHANNEL = process.env.COMPETITION_CHANNEL_NAME;

export class RepinMessageCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "repin-message",
      description: "Repin the competition corner message.",
      preconditions: ["CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description),
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
      const message = await channel.messages.fetch(
        process.env.COMPETITION_WEEKLY_POST_ID,
      );

      await message.unpin();
      await message.pin();

      return interaction.reply({
        content: "Message has been re-pinned.",
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
