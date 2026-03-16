import "dotenv/config";
import { Command } from "@sapphire/framework";
import { buildRaffleModal } from "../../lib/raffle/raffleModal.js";

export class ChangeRaffleEntryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "change-raffle-entry",
      description: "Change your weekly raffle table entry.",
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    await interaction.showModal(
      buildRaffleModal("change-raffle-modal", "Change Raffle Entry", false),
    );
  }
}
